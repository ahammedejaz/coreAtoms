# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Core Atoms** is a nutraceutical e-commerce platform with three sub-projects sharing a single Supabase backend:
- `frontend/` — React 19 + Vite 8 + Tailwind CSS v4 (customer storefront + admin dashboard)
- `mobile/` — Expo SDK 54 / React Native (customer-only, Android + iOS)
- `supabase/` — Deno Edge Functions and database migrations

## Commands

### Frontend (`cd frontend`)
```bash
npm run dev        # Start Vite dev server (http://localhost:5173)
npm run build      # Production build → dist/
npm run lint       # ESLint (v9 flat config)
npm run preview    # Serve built output
```

### Mobile (`cd mobile`)
```bash
npx expo start            # Start Expo dev server (Expo Go compatible)
npx expo start --android  # Android emulator
npx expo start --ios      # iOS simulator
npx expo prebuild         # Required before running Razorpay (native module)
```

### Supabase Edge Functions (`cd frontend`)
```bash
npx supabase functions serve <function-name>  # Serve a single function locally
npx supabase db push                          # Push migrations to remote
```

## Environment Setup

**Frontend** — copy `frontend/.env.local.example` → `frontend/.env.local`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_RAZORPAY_KEY_ID=     # optional in dev
```

**Mobile** — copy `mobile/.env.example` → `mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_RAZORPAY_KEY_ID=
```

The mobile app uses `EXPO_PUBLIC_` prefix so Expo inlines values into the bundle at build time.

## Architecture

### Backend: Supabase (no separate API server)
All data access goes directly from client → Supabase via the JS SDK. There is no Express/Fastify/Next.js API layer. Complex operations (order placement, cancellation) are Postgres RPCs to avoid race conditions and enforce atomicity.

Key RPCs: `place_order_cod`, `place_order_prepaid`, `cancel_order`

Edge Functions (Deno, in `frontend/supabase/functions/`):
- `create-razorpay-order` / `verify-razorpay-payment` — payment processing
- `delhivery-pincode-check` — delivery availability by pincode
- `delhivery-create-shipment` — creates waybill after order confirmed
- `delhivery-track` — live tracking (mobile only currently)
- `send-order-notification` — push notification after order events (in root `supabase/`)

**SQL lives in two trees.** `frontend/supabase/migrations/master_schema.sql` is the big idempotent file
covering tables, RLS policies, triggers and RPCs, but it has drifted from production: the newer objects
(`push_tokens`, the push trigger, the realtime publication, the RPC grant hardening) were added as timestamped
migrations in the **root** `supabase/migrations/`, which is the tree the Supabase CLI is linked to and where
`npx supabase db push` applies from. Read both, and confirm against the live database before trusting either.
`supabase/migrations/20260304_existing.sql` is empty on purpose — it is the baseline marker matching the remote
migration record, so do not delete it.

Key tables: `products`, `product_variants`, `product_images`, `product_reviews`, `orders`, `order_items`, `user_addresses`, `app_settings`, `corecoins_wallet`, `replacements`, `push_tokens`

**Product content**: `products.details` (JSONB) holds the PDP's structured sections —
`{ benefits: [{icon,title,text}], ingredients: [{name,amount,purpose}], howToUse: [string], faqs: [{q,a}], safetyInfo: string }`.
`normalizeProductDetails()` in `frontend/src/services/products.js` is the canonical shape guard; `components/RichText.jsx`
renders `description`/`about_text` preserving pasted line breaks, bullets and monograph headings; the admin's structured
editor plus the Auto-organise importer live in `frontend/src/pages/admin/ProductDetailsEditor.jsx`. PDP sections render
only when their content exists.

### Frontend Architecture

**Provider tree** (see `frontend/src/main.jsx`):
```
ToastProvider → AuthProvider → CartProvider → RouterProvider
```
There is no Helmet provider — React 19 hoists `<title>` and `<meta>` into `<head>` from anywhere in the tree, so
`components/SEO.jsx` renders them as plain elements.

**Routing** (`frontend/src/routes/AppRoutes.jsx`) uses React Router v7 with lazy-loaded pages. Admin routes are guarded by `AdminRoute` (checks `isAdmin` from AuthContext). Authenticated routes use `ProtectedRoute` which redirects to `/login?redirect=<URL>`.

**State management**: Context only — no Redux/Zustand.
- `AuthContext` — session, user, profile, `isAdmin`. Caches profile in localStorage (`coreatoms_profile`) excluding the `role` field to prevent stale admin elevation. 1-hour inactivity signout.
- `CartContext` — persists to `localStorage` key `coreatoms_cart`. Enforces `max_items_per_order` fetched from `app_settings`. Merges guest cart on sign-in.
- `ToastContext` — lightweight notification system.

**Services** (`frontend/src/services/`): Thin wrappers around Supabase queries. `mapDbProduct()` in `products.js` is the canonical DB→UI mapper used by both web and mobile.

**Admin dashboard** is embedded in the same React app under `/admin` routes (`frontend/src/pages/admin/`), not a separate deployment. Admin access is controlled by `profiles.role = 'admin'` in Supabase.

### Mobile Architecture

**Provider tree** (see `mobile/App.js`):
```
SafeAreaProvider → ErrorBoundary → ToastProvider → AuthProvider → CartProvider → NetworkBanner → AppNavigator
```

**Navigation** (`mobile/src/navigation/AppNavigator.jsx`):
- Bottom Tab Navigator (5 tabs: Home, Shop, Cart, Orders, Profile)
- Login is a **modal** (bottom sheet stack), not a separate tab
- `withAuthGate(Screen)` HOC redirects to Login modal for protected screens (Orders, Profile, Checkout)
- ProductDetail is nested in both HomeStack and ShopStack (tabs retain independent navigation history)

**Key differences from web**:
- `AsyncStorage` replaces `localStorage` everywhere (cart key `coreatoms_cart`, profile cache `coreatoms_profile`)
- `AppState` replaces DOM visibility events for inactivity detection
- Supabase client configured with 30s fetch timeout for slow networks
- Razorpay requires `npx expo prebuild` and native build — COD works in Expo Go
- `EXPO_PUBLIC_` env prefix instead of `VITE_`
- Theme constants centralized in `mobile/src/constants/theme.js` (COLORS, FONTS, SPACING, RADIUS, SHADOWS)

### Business Logic

**GST**: Intra-state (Andhra Pradesh warehouse) → CGST + SGST split. Inter-state → IGST only. `WAREHOUSE_STATE = 'andhra pradesh'` in mobile theme constants; frontend uses inline string comparison.

**Shipping**: Tries pincode-based rate via `delhivery-pincode-check` edge function first; falls back to flat rate from `app_settings`. Free shipping threshold also from settings.

**CoreCoins**: Loyalty points earned on purchase (configurable rate). Redeemable at checkout with value defined in `app_settings`. Logic lives in Checkout pages on both platforms.

**Coupons**: Codes live in `app_settings.discount_codes` (there is no `coupons` table). The client applies the discount to the subtotal before tax for display, but the order RPC ignores the `p_discount` it is sent and re-derives the discount from the stored code.

**Order flow**: Cart → Address selection → Shipping calc → Payment method (COD or Razorpay) → `place_order_cod` RPC or Razorpay payment flow → `place_order_prepaid` RPC after payment verification.

### Live Updates

**Realtime**: `Home.jsx` and `Shop.jsx` subscribe to `postgres_changes` on `products`; `MyOrders.jsx` subscribes
to `orders` filtered by `user_id`. Handlers debounce 500ms and re-run the page's loader. Nothing fires unless the
table is in the `supabase_realtime` publication — `orders` and `products` are.

**Push**: an `orders.status` UPDATE fires `notify_order_status_change`, which calls the `send-order-notification`
Edge Function over `pg_net`; it looks up the user's `push_tokens` rows and sends via the Expo Push API. Mobile
registers tokens in `mobile/src/services/notifications.js` (physical devices only) and drops them on sign-out.

### Security Model

- Order RPCs are `SECURITY DEFINER` and re-derive price, GST, shipping and coupon discount server-side. The
  `p_gst` and `p_discount` arguments are accepted for compatibility and ignored.
- **GST is charged on the discounted taxable value** (`subtotal - coupon discount`), not the gross subtotal.
  Client and RPC must always agree on this — `Checkout.jsx` and both order RPCs compute
  `taxable = subtotal - discount`, then `gst = round(taxable * pct)`, then `total = taxable + shipping + gst - coins`.
- **Coupon restrictions are enforced server-side.** `resolve_coupon_percentage(code, user_id)` is the single
  source of truth for `active`, `startsAt`/`endsAt`, the `emails` whitelist and `newUsersOnly`; both order RPCs
  and the customer-facing `validate_coupon(code)` call it. Checkout must never validate coupons from the raw
  `discount_codes` setting again — that is how targeted codes leaked to every signed-in customer.
- **Prepaid orders are verified by amount, not just by signature.** The Razorpay HMAC only proves a payment
  belongs to an order; it says nothing about how much was paid. `verify-razorpay-payment` reads the captured
  amount from Razorpay's API and passes it as `p_amount_paid_paise`, and `place_order_prepaid` rejects the order
  if its own computed total exceeds what was actually paid. `place_order_prepaid` is also idempotent on
  `razorpay_payment_id` (backed by a partial unique index), so a retry returns the existing order instead of
  duplicating stock and coin deductions.
- Variant purchases decrement `product_variants.stock_qty`; only non-variant purchases touch `products.stock_qty`.
  `cancel_order` restores stock to whichever table the line came from and refunds redeemed CoreCoins.
- `profiles` UPDATE carries a `WITH CHECK` that blocks a customer from setting their own `role` to `admin`.
  Never add a second permissive UPDATE policy on `profiles` without that guard — permissive policies OR together,
  so one unguarded policy re-opens full admin self-elevation.
- `EXECUTE` is granted narrowly: `place_order_cod`, `cancel_order`, `process_pending_corecoins` and
  `log_failed_order` to `authenticated`; `place_order_prepaid` to `service_role` only, because just the
  `verify-razorpay-payment` Edge Function calls it. `anon` can execute nothing except `is_admin()`, which RLS
  policies depend on. Do not re-grant to `anon` — the guards compare `p_user_id` against `auth.uid()`, which is
  NULL for anonymous callers, so an anon grant means anyone can place orders as anyone.
- `app_settings` must have exactly **one** permissive SELECT policy — permissive policies OR together, so a
  second one silently defeats the sensitive-key filter. Today it hides `discount_codes`, `warehouse_address`,
  `delhivery_client_name` and `delhivery_pickup_name` from anonymous users.
  `supabase/migrations/20260831090000_restrict_discount_codes_to_admins.sql` tightens those four to admins only
  and is **deliberately not applied yet**: it must go out with the web release that ships the `validate_coupon`
  version of Checkout, or coupon entry breaks on the live site.
- Every Edge Function that touches money or customer data verifies the caller with
  `supabase.auth.getUser(token)` — never by base64-decoding the JWT. `create-razorpay-order`,
  `verify-razorpay-payment` and `delhivery-track` all require a real signed-in user, and `delhivery-track`
  additionally checks the caller owns an order or replacement carrying that waybill.
- The shared rate limiter keys on the **right-most** `x-forwarded-for` hop. The left-most entry is
  caller-supplied, so reading it let anyone defeat every limit with a random header per request.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `RAZORPAY_KEY_SECRET` to a client; they belong in Edge Function
  secrets only.

## Key Design Decisions

- **No TypeScript** — entire codebase is `.js`/`.jsx`. JSDoc is used in some files for documentation.
- **Tailwind v4** — CSS-first configuration. There is no `tailwind.config.js`; all customization lives in
  `frontend/src/index.css`.
- **Two Supabase trees** — `master_schema.sql` describes the bulk of the schema, but it is no longer the whole
  truth (see Backend above). New schema changes go in the root `supabase/migrations/` as timestamped files,
  because that is what the CLI applies.
- **Mobile mirrors web services** — `mobile/src/services/` and `frontend/src/services/` share the same Supabase queries and `mapDbProduct()` shape. Changes to data models must be reflected in both.
- **Admin in same app** — the admin dashboard is not a separate Vite project; it shares the customer app's build, router, and contexts.

## Detailed Documentation

`frontend/.project/PROJECT_KNOWLEDGE.md` — comprehensive onboarding doc covering full schema, all RPCs, component catalogue, and business logic edge cases. Read this before making changes to order placement, GST, CoreCoins, or replacement logic.

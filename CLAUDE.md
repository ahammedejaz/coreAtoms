# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Core Atoms** is a nutraceutical e-commerce platform with three sub-projects sharing a single Supabase backend:
- `frontend/` — React 18 + Vite + Tailwind CSS (customer storefront + admin dashboard)
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

Schema lives in `frontend/supabase/migrations/master_schema.sql` — one idempotent file covering all tables, RLS policies, triggers, and RPCs.

Key tables: `products`, `product_variants`, `product_images`, `product_reviews`, `orders`, `order_items`, `user_addresses`, `app_settings`, `corecoins_wallet`, `replacements`

### Frontend Architecture

**Provider tree** (see `frontend/src/main.jsx`):
```
HelmetProvider → ToastProvider → AuthProvider → CartProvider → RouterProvider
```

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

**Coupons**: Validated against `coupons` table in Supabase at checkout. Applied as discount on subtotal before tax.

**Order flow**: Cart → Address selection → Shipping calc → Payment method (COD or Razorpay) → `place_order_cod` RPC or Razorpay payment flow → `place_order_prepaid` RPC after payment verification.

## Key Design Decisions

- **No TypeScript** — entire codebase is `.js`/`.jsx`. JSDoc is used in some files for documentation.
- **Tailwind v4** — CSS-first configuration. No `theme.extend` in `tailwind.config.js`; all customization is in `frontend/src/index.css`.
- **Single Supabase schema file** — `master_schema.sql` is idempotent and authoritative. Do not create separate migration files; update the master file.
- **Mobile mirrors web services** — `mobile/src/services/` and `frontend/src/services/` share the same Supabase queries and `mapDbProduct()` shape. Changes to data models must be reflected in both.
- **Admin in same app** — the admin dashboard is not a separate Vite project; it shares the customer app's build, router, and contexts.

## Detailed Documentation

`frontend/.project/PROJECT_KNOWLEDGE.md` — comprehensive onboarding doc covering full schema, all RPCs, component catalogue, and business logic edge cases. Read this before making changes to order placement, GST, CoreCoins, or replacement logic.

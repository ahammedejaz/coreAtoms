# Core Atoms — Complete Project Knowledge Base
> **Purpose:** This document is written for an AI assistant (or new engineer) who needs to fully understand the Core Atoms e-commerce project. Read this before touching any code. It covers architecture, data model, business logic, environment setup, and every major feature.

---

## 1. Project Overview

**Core Atoms** is a premium Indian nutraceutical brand (supplements). This repository is a **full-stack web application** consisting of:

- A **React 18 + Vite** single-page frontend deployed on **Vercel**
- A **Supabase** backend (PostgreSQL + Row Level Security + Auth + Storage + Edge Functions)
- **Delhivery** integration for logistics (pincode checks, shipment creation, tracking)
- **Razorpay** integration for online payments
- A **CoreCoins** loyalty programme (earn coins on delivery, redeem at checkout)

There is **no separate Node/Express server**. All backend logic lives in:
1. Supabase PostgreSQL RPCs (stored procedures)
2. Supabase Edge Functions (Deno TypeScript, deployed to `supabase/functions/`)

---

## 2. Repository Layout

```
frontend/
├── src/
│   ├── components/         # Reusable UI components
│   ├── context/            # React Context providers (Auth, Cart, Toast)
│   ├── hooks/              # Custom hooks (useDebounce, etc.)
│   ├── layouts/            # Layout wrappers (AppLayout)
│   ├── pages/              # Page-level components
│   │   └── admin/          # Admin-only sub-pages
│   ├── routes/             # React Router configuration
│   ├── services/           # Supabase query helpers + Razorpay loader
│   ├── utils/              # Formatting utilities (money, dates)
│   └── index.css           # Global Tailwind + custom CSS
├── supabase/
│   ├── functions/          # Supabase Edge Functions (Deno)
│   │   ├── _shared/            # Shared utilities (CORS, etc.)
│   │   │   └── cors.ts         # Origin-validated CORS headers
│   │   ├── create-razorpay-order/
│   │   ├── verify-razorpay-payment/
│   │   ├── delhivery-pincode-check/
│   │   ├── delhivery-create-shipment/
│   │   └── delhivery-track/
│   └── migrations/
│       └── master_schema.sql   ← SINGLE SOURCE OF TRUTH — run this
├── public/                 # Static assets (hero images, product images)
├── .env.local              # Local secrets (never commit)
├── .env.local.example      # Template for env vars
├── vite.config.js
├── tailwind.config.js
└── vercel.json
```

---

## 3. Environment Variables

### Frontend (`.env.local`)
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...         # public anon key
VITE_RAZORPAY_KEY_ID=rzp_live_xxx     # public Razorpay key (safe to expose)
```

### Supabase Edge Function Secrets (set via Supabase Dashboard → Settings → Edge Functions)
```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...         # admin key — NEVER expose on frontend
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx               # NEVER expose on frontend
DELHIVERY_TOKEN=...
DELHIVERY_CLIENT_NAME=...
```

---

## 4. Database Schema

All tables are in the `public` schema. RLS is enabled on every table.

### Tables

| Table | Purpose |
|---|---|
| `profiles` | Mirrors `auth.users`. Stores `role` ('customer' or 'admin') |
| `products` | Product catalogue with stock, pricing, images, metadata |
| `product_images` | Gallery images per product (many-to-one) |
| `product_variants` | Size/pack variants per product (e.g. 60 caps, 90 caps) |
| `product_reviews` | Star ratings + comments, linked to product + order |
| `user_addresses` | Saved delivery addresses per customer |
| `orders` | One row per order — see section 4.1 |
| `order_items` | Line items for each order |
| `app_settings` | Admin-controlled key-value config store |
| `corecoins_wallet` | Loyalty coin balance per user |
| `replacements` | Damage/replacement requests per delivered order |

### 4.1 Orders table — key columns

```sql
status           TEXT  -- 'placed'|'processing'|'shipped'|'delivered'|'cancelled'|'payment_failed'
shipping_address JSONB -- snapshot of address at order time (not a FK)
payment_method   TEXT  -- 'cod' | 'prepaid'
total_amount_inr NUMERIC -- final amount = items + shipping + gst - coin_discount - coupon_discount
subtotal         NUMERIC -- items only
shipping_amount  NUMERIC -- shipping charged (0 if free)
gst_amount       NUMERIC -- GST amount (0 if gst_percent = 0)
discount_amount  NUMERIC -- coupon discount amount (0 if no coupon)
coupon_code      TEXT    -- coupon code used (NULL if none)
coins_used       INT   -- CoreCoins deducted at checkout
coins_credited   BOOL  -- have earn-coins been given to wallet?
coins_credit_after TIMESTAMPTZ -- when to credit (delivery + window)
razorpay_payment_id TEXT
delhivery_waybill   TEXT
```

### 4.2 app_settings keys

| key | value shape | description |
|---|---|---|
| `gst_percentage` | `{percentage: 5}` | GST %. 0 = no GST |
| `shipping_amount` | `{amount: 0}` | Flat shipping. 0 = use Delhivery pincode rate |
| `free_shipping_min` | `{amount: 500}` | Cart subtotal for free shipping. 0 = disabled |
| `razorpay_enabled` | `{enabled: true}` | Show/hide online payment option |
| `cod_enabled` | `{enabled: true}` | Show/hide COD option |
| `discount_codes` | `[{code, percentage, active, startsAt, endsAt}]` | Coupon codes |
| `replacements_enabled` | `{enabled: true, window_days: 1, window_minutes: 0}` | Replacement feature + window. When `window_minutes > 0`, minutes are used instead of days. |
| `corecoins_enabled` | `{enabled: true}` | Enable/disable loyalty programme |
| `corecoins_config` | `{earn_rate:2, earn_per_rupees:100, coin_value_inr:1, min_redeem:100}` | Coins math |
| `promo_banner` | `{enabled, text, link, bgColor, textColor}` | Floating promo bar |
| `homepage_*` | various | Hero images, copy, pillars, categories, philosophy, featured products |

---

## 5. Stored Procedures (RPCs)

Call these with `supabase.rpc('function_name', { ...args })`.

> **Security:** All order RPCs enforce `auth.uid()` checks — users cannot place orders for other users. `place_order_prepaid` allows service-role bypass (for Edge Function calls).

### `place_order_cod(p_user_id, p_address, p_items, p_coins_used, p_shipping, p_gst, p_discount, p_coupon_code)`
- **Auth guard:** `p_user_id` must match `auth.uid()`
- Atomically deducts CoreCoins, checks/deducts stock, creates order + items
- **Server-side coupon validation:** `p_discount` is IGNORED — coupon is looked up from `discount_codes` in `app_settings` by `p_coupon_code`, validated for active status and schedule (startsAt/endsAt), and discount % applied to subtotal
- Calculates `total_amount_inr = subtotal + shipping + gst - coin_discount - coupon_discount`
- Returns: `order_id UUID`

### `place_order_prepaid(p_user_id, p_address, p_items, p_payment_method, p_razorpay_payment_id, p_razorpay_order_id, p_coins_used, p_shipping, p_gst, p_discount, p_coupon_code)`
- **Auth guard:** `p_user_id` must match `auth.uid()` (bypassed for service-role calls where `auth.uid()` is NULL)
- Same server-side coupon validation as `place_order_cod`
- Same as above but includes Razorpay payment IDs
- Called by the `verify-razorpay-payment` Edge Function (not directly from client)

### `log_failed_order(p_user_id, p_address, p_items, p_reason, p_shipping, p_gst)`
- Inserts an order with `status = 'payment_failed'` (no stock deduction)
- Called client-side when Razorpay payment is authorised but verification fails

### `process_pending_corecoins(p_user_id)` → returns `INTEGER`
- **Auth guard:** `p_user_id` must match `auth.uid()`
- Credits any overdue loyalty coins for the given user
- Returns the number of orders processed
- Called by `MyOrders.jsx` on load — replaces the need for pg_cron

### Trigger: `credit_corecoins()` on `orders` (BEFORE UPDATE)
- Fires **BEFORE UPDATE** when `status` changes to `'delivered'`
- Uses BEFORE (not AFTER) to avoid "tuple already modified" errors — modifies `NEW` directly
- If replacements disabled → credits coins immediately
- If replacements enabled → sets `coins_credit_after = delivered_at + window`
- If `window_minutes > 0`, uses minutes; otherwise uses `window_days`

---

## 6. Edge Functions (Supabase / Deno)

All functions live in `supabase/functions/`. They use the service role key and are NOT exposed to the client directly.

> **Security:** All Edge Functions use a shared CORS utility (`_shared/cors.ts`) that restricts origins to `coreatoms.in`, `www.coreatoms.in`, `core-atoms.vercel.app`, `*.vercel.app` (previews), and `localhost`.

### `_shared/cors.ts`
- Shared CORS utility imported by all Edge Functions
- `getCorsHeaders(req)` — returns validated CORS headers based on request origin
- `handleCorsPreflightRequest(req)` — returns preflight response
- Replaces the old `Access-Control-Allow-Origin: *` wildcard

### `create-razorpay-order`
- Called by `Checkout.jsx` before opening the Razorpay modal
- Accepts: `{amount, currency, receipt}`
- Creates a Razorpay order via their REST API
- Returns: `{id, amount, currency}`

### `verify-razorpay-payment`
- Called by `Checkout.jsx` after Razorpay `onSuccess`
- Accepts: `{razorpay_order_id, razorpay_payment_id, razorpay_signature, user_id, address, items, coins_used, shipping, gst}`
- Verifies HMAC SHA256 signature using the secret key
- If valid → calls `place_order_prepaid` RPC
- Returns: `{success: true, order_id}`

### `delhivery-pincode-check`
- Accepts: `{pincode, weight_grams?}`
- Calls Delhivery's availability API + freight charge API (two parallel calls: `md=E` for prepaid, `md=E&pt=COD` for COD)
- Returns: `{serviceable, shipping_charge, shipping_charge_prepaid, shipping_charge_cod}`
- Used in `Checkout.jsx` when admin flat rate = 0; the selected payment method determines which rate is applied

### `delhivery-create-shipment`
- **Admin auth required:** Verifies JWT and checks `profiles.role = 'admin'` before proceeding
- Called from `AdminOrders.jsx` when admin ships an order
- Creates a Delhivery waybill and updates the `orders` row with waybill + tracking URL

### `delhivery-track`
- Accepts: `{waybill}`
- Returns live tracking events from Delhivery
- Used by `ShipmentTracker.jsx` component

---

## 7. Frontend Architecture

### State Management
- **Auth:** `AuthContext` (session, user object from Supabase Auth)
- **Cart:** `CartContext` (items array in localStorage, qty management, per-item CoreCoins tracking)
- **Toast:** `ToastContext` (global notification system)
- No Redux / Zustand. All page-level state is local `useState`.

### Routing (`src/routes/`)
- `AppLayout` wraps all routes: `Navbar` + optional `Footer`
- Protected routes redirect to `/login` if no session
- Admin routes additionally check `profile.role === 'admin'`

### Key Pages

| Route | Component | Description |
|---|---|---|
| `/` | `Home.jsx` | Landing with admin-customisable hero, pillars, categories, philosophy |
| `/shop` | `Shop.jsx` | Product grid + search + category filter |
| `/product/:id` | `ProductDetail.jsx` | Full product page with variants, reviews, pincode checker |
| `/cart` | `Cart.jsx` | Cart summary with CoreCoins toggle |
| `/checkout` | `Checkout.jsx` | Address selection, shipping calc, GST, coupons, COD/Razorpay |
| `/orders` | `MyOrders.jsx` | Order history with full bill breakdown + replacement + review |
| `/admin` | `AdminDashboard.jsx` | Admin shell (sidebar + sub-pages) |
| `/admin/products` | `AdminProducts.jsx` | Full product CRUD |
| `/admin/orders` | `AdminOrders.jsx` | Order management, status updates, Delhivery shipping |
| `/admin/settings` | `AdminSettings.jsx` | All app_settings in accordion UI |
| `/admin/homepage` | `AdminHomepage.jsx` | Homepage CMS |
| `/admin/corecoins` | `AdminCoreCoins.jsx` | View all customer wallet balances (paginated) |
| `/admin/replacements` | `AdminReplacements.jsx` | Review and action replacement requests |
| `/admin/reviews` | `AdminReviews.jsx` | Review moderation |

---

## 8. Checkout Flow (Critical — Read Carefully)

```
Customer fills address
       ↓
Checkout.jsx fetches: shipping_amount, free_shipping_min, gst_percentage,
                      razorpay_enabled, cod_enabled, discount_codes,
                      corecoins_enabled + config, user's coin balance
       ↓
If shippingBase = 0 AND pincode entered:
  → delhivery-pincode-check Edge Function → returns shipping_charge_prepaid + shipping_charge_cod
       ↓
User selects payment method (COD or Prepaid) → billing updates reactively
       ↓
Pricing computed client-side:
  sub         = cart item total
  shipping    = 0 (free) OR pincodeShippingCod/pincodeShippingPrepaid OR shippingBase
  gstAmount   = Math.round(sub * gstPercent / 100)   [0 if gstPercent = 0]
  coinDiscount= coinsUsed * coin_value_inr
  total       = sub + shipping + gstAmount - coinDiscount

  ── COD path ──
  supabase.rpc('place_order_cod', {..., p_shipping, p_gst, p_coupon_code})
  → RPC validates auth.uid(), validates coupon server-side, ignores p_discount
  → success: show receipt screen → 5s → redirect to /orders

  ── Prepaid path ──
  1. supabase.functions.invoke('create-razorpay-order', {amount: total * 100})
  2. Open Razorpay modal
  3. onSuccess → supabase.functions.invoke('verify-razorpay-payment', {..., shipping, gst})
     → Edge Function: verify HMAC signature → call place_order_prepaid RPC
     → RPC validates auth (service-role bypass), validates coupon server-side
  4. success: show receipt screen → 5s → redirect to /orders
  5. If verification fails: call log_failed_order RPC (creates 'payment_failed' order)
```

> **Note:** Coupon discounts are never trusted from the client. Both RPCs look up `p_coupon_code` in `app_settings.discount_codes`, validate active status and schedule, and compute the discount percentage server-side.

---

## 9. CoreCoins Loyalty Programme

### Earning
- Triggered by `credit_corecoins()` BEFORE UPDATE trigger when order status → `'delivered'`
- Formula: `coins = floor((total_paid / earn_per_rupees) * earn_rate)`
  - Default: 2 coins per ₹100 spent
- If replacements are enabled: deferred by the replacement window
  - If `window_minutes > 0` → uses minutes (e.g., set to 2 for quick testing)
  - Otherwise → uses `window_days` (default: 1 day)
  - `process_pending_corecoins(user_id)` picks these up on next MyOrders page load

### Redeeming
- At checkout, if `corecoinsEnabled` and balance ≥ `min_redeem`:
  - User can toggle using coins
  - `coinsUsed = min(balance, total)` (capped to order total)
  - `coinsDiscount = coinsUsed * coin_value_inr` (default: 1 coin = ₹1)

### Admin View
- `/admin/corecoins` shows all wallets with pagination (50/page)
- Cannot manually adjust balances (by design — only automated via delivery)

---

## 10. Shipping Logic

1. Admin sets `shipping_amount.amount` in Admin Settings
2. If `amount > 0` → flat rate applies to ALL orders
3. If `amount = 0` → per-pincode mode: Delhivery API called at checkout
4. `free_shipping_min.amount > 0` → orders above this threshold get free shipping
5. Free shipping overrides both flat and pincode rates

GST is applied on the **items subtotal only** (not on shipping) using `gst_percentage.percentage`.

---

## 11. Replacement System

1. Customer submits request from `MyOrders.jsx` (photo uploads to `replacement-images` bucket)
2. Admin reviews in `AdminReplacements.jsx`
3. Admin approves → can choose:
   - **Severe damage**: direct replacement shipment via Delhivery
   - **Minor damage**: reverse pickup first, then new shipment after receipt
4. Status flow: `pending → approved → pickup_scheduled → pickup_received → replacement_shipped`

---

## 12. Admin Settings Reference (AdminSettings.jsx)

The settings page is organised as collapsible accordion sections:
- **Shipping & Tax**: flat rate, free shipping threshold, GST %
- **Payments**: Razorpay toggle, COD toggle, Razorpay API keys (display only)
- **Discounts**: Add/remove coupon codes with % off, date range, active toggle
- **Replacements**: Enable feature, configure window in days or minutes (minutes override days when > 0)
- **CoreCoins**: Enable feature, configure earn_rate, earn_per_rupees, coin_value_inr, min_redeem
- **Promo Banner**: Enable/disable, custom text + link + colours
- **Homepage**: Hero images (with position adjuster), copy, pillars, categories, philosophy, featured products

---

## 13. Product Label: "Excl. GST & Shipping" vs "Excl. Shipping"

The product card and product detail page read `gst_percentage` from `app_settings`.
- `gst_percentage.percentage > 0` → shows **"Excl. GST & Shipping"**
- `gst_percentage.percentage = 0` → shows **"Excl. Shipping"**

This is fetched in `Shop.jsx` (alongside products), `Home.jsx` (alongside hero settings), and `ProductDetail.jsx` (alongside product data) — all parallel fetches, no extra round trip.

---

## 14. Order Status in MyOrders / AdminOrders

| Status | Customer label | Admin action |
|---|---|---|
| `placed` | Placed | Move to Processing / Cancel |
| `processing` | Processing | Ship via Delhivery |
| `shipped` | Shipped | — (auto-updates via Delhivery webhook or manual) |
| `out_for_delivery` | Out for Delivery | — (auto-synced from Delhivery tracking) |
| `delivered` | Delivered | — |
| `cancelled` | Cancelled | — |
| `payment_failed` | Payment Failed | No action needed — customer retries |

> **Note:** The customer-facing `OrderTimeline` shows 4 steps: Placed → Shipped → Out for Delivery → Delivered. Orders with `processing` status map to the "Placed" step visually.

---

## 15. Component Catalogue

| Component | File | Role |
|---|---|---|
| `Navbar` | `Navbar.jsx` | Top navigation with cart count badge, auth state |
| `Footer` | `Footer.jsx` | Static footer |
| `ProductCard` | `Shop.jsx` (exported) | Used by Shop and Home featured grid |
| `ProductDetail` | `ProductDetail.jsx` | Full product page |
| `OrderTimeline` | `OrderTimeline.jsx` | Visual step progress for order status |
| `ShipmentTracker` | `ShipmentTracker.jsx` | Live Delhivery tracking via Edge Function |
| `PincodeChecker` | `PincodeChecker.jsx` | Delivery availability checker on product page |
| `PromoBanner` | `PromoBanner.jsx` | Admin-controlled floating announcement bar |
| `SEO` | `SEO.jsx` | `<title>` + `<meta>` injection |
| `ScrollReveal` | `ScrollReveal.jsx` | Intersection Observer fade-in animation |
| `Skeleton` | `Skeleton.jsx` | Loading skeletons for product grid and product detail |
| `Toast` | `Toast.jsx` | Global toast notification UI |
| `ConfirmDialog` | `ConfirmDialog.jsx` | Modal confirmation dialog (used instead of `window.confirm`) |
| `ErrorBoundary` | `ErrorBoundary.jsx` | React error boundary with fallback UI |
| `ImagePositionAdjuster` | `ImagePositionAdjuster.jsx` | Visual drag tool for hero image focal points |
| `AdminSettingsCard` | `AdminSettingsCard.jsx` | Shared card wrapper for admin settings sections |

---

## 16. Services / API Layer (`src/services/`)

| File | Exports | Description |
|---|---|---|
| `supabase/client.js` | `supabase` | Configured Supabase JS client |
| `products.js` | `fetchProducts`, `fetchProductById` | Product queries with variants, images, reviews |
| `orders.js` | order helpers | Used by admin order management |
| `addresses.js` | address CRUD | User saved addresses |
| `homepage.js` | homepage settings | Save/load homepage CMS data |
| `razorpay.js` | `loadRazorpay`, `getRazorpayKeyId` | Loads Razorpay SDK dynamically, returns key from env |
| `errorReporter.js` | `reportError` | Console error logging (extendable to Sentry) |

---

## 17. Styling System

- **Tailwind CSS** with custom config
- Custom utility classes defined in `index.css`:
  - `.btn-primary` — main CTA button with navy gradient
  - `.btn-ghost` — outlined button
  - `.card` — standard card container
  - `.section-label` — small uppercase heading
  - `.card-shine` — button/card with animated shine sweep effect
- Consistent brand colour: `#1e3a5f` (dark navy)
- Border colour: `#E8E4DE` (warm stone)

---

## 18. Deployment

- **Frontend**: Vercel. `vercel.json` has SPA rewrite rule (all routes → `/index.html`)
- **Backend**: Supabase (managed). No self-hosted instance.
- **Edge Functions**: deployed via `supabase functions deploy <name>`
- **Build**: `npm run build` → Vite bundles to `dist/`

---

## 19. Common Gotchas & Rules

1. **Never expose `SUPABASE_SERVICE_ROLE_KEY` or `RAZORPAY_KEY_SECRET` on the frontend.** These live only in Edge Function environment variables.
2. **`gst_percentage` is stored as `{percentage: 5}`, not as a plain number.** Always read `.value.percentage`.
3. **Shipping is GST-free.** GST applies to items subtotal only.
4. **`place_order_cod` and `place_order_prepaid` are the only ways to create valid orders.** Direct `INSERT` into `orders` from the client will fail RLS.
5. **Product name and price are snapshotted into `order_items`** at order time. Never read them back from `products` for order display.
6. **CoreCoins are credited after delivery, not after payment.** They are deferred further when replacements are enabled.
7. **Admin role is set by updating `profiles.role = 'admin'`** — do this via Supabase Dashboard or SQL for the first admin. Subsequent admins can be promoted via admin UI if implemented.
8. **The `master_schema.sql` in `supabase/migrations/` is the only SQL file that matters.** All other migration files are superseded by it and kept for historical reference only.
9. **Razorpay uses the `.env.local` key for UI rendering and the Edge Function secret for server-side verification.** Both are needed.
10. **All monetary values are stored in INR as `numeric(10,2)`.** The frontend `money()` utility formats them with `₹` prefix using `en-IN` locale.
11. **Coupon discounts are validated server-side.** The `p_discount` parameter in order RPCs is IGNORED — the RPC looks up the coupon code in `app_settings.discount_codes` and computes the discount itself.
12. **CORS is restricted.** Edge Functions only accept requests from `coreatoms.in`, `www.coreatoms.in`, `core-atoms.vercel.app`, Vercel previews, and localhost. Update `_shared/cors.ts` if domains change.
13. **`app_settings` has granular RLS.** Sensitive keys (`discount_codes`, `warehouse_address`) require authentication to read. All other keys are publicly readable.
14. **`delhivery-create-shipment` requires admin auth.** The Edge Function verifies the caller's JWT and checks `profiles.role = 'admin'` before creating shipments.
15. **`fetchProductById` reads `reviewer_name` from `product_reviews` directly** — it does NOT query the `profiles` table. This prevents cross-user data leakage.

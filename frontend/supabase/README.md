# Supabase — Database & Edge Functions

Complete backend reference for the **Core Atoms** application.  
Covers all database tables, RPC functions, Edge Functions, Row-Level Security (RLS), and the Razorpay payment integration.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [RPC Functions](#rpc-functions)
4. [Edge Functions](#edge-functions)
5. [Razorpay Payment Flow](#razorpay-payment-flow)
6. [Row-Level Security (RLS)](#row-level-security-rls)
7. [Environment Variables & Secrets](#environment-variables--secrets)
8. [Migrations](#migrations)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────┐          ┌──────────────────────────────┐
│   React Frontend    │          │       Supabase Cloud         │
│  (Vite + React 19)  │          │                              │
│                     │          │  ┌────────────────────────┐  │
│  supabase.from()  ──┼──REST──▶ │  │   PostgreSQL (RLS)     │  │
│  supabase.rpc()   ──┼──REST──▶ │  │   Tables + RPC Funcs   │  │
│  supabase.auth    ──┼──REST──▶ │  └────────────────────────┘  │
│                     │          │                              │
│  supabase.functions ─┼──HTTPS─▶│  ┌────────────────────────┐  │
│  .invoke()          │          │  │   Edge Functions (Deno) │  │
│                     │          │  │   • create-razorpay-order│ │
│                     │          │  │   • verify-razorpay-payment││
│                     │          │  └──────────┬─────────────┘  │
│                     │          │             │                │
│                     │          │             ▼                │
│                     │          │  ┌────────────────────────┐  │
│                     │          │  │     Razorpay API       │  │
│                     │          │  └────────────────────────┘  │
└─────────────────────┘          └──────────────────────────────┘
```

---

## Database Schema

### `profiles`

Stores user profile data. Automatically populated by a Supabase Auth trigger on sign-up.

| Column      | Type        | Nullable | Default       | Description                       |
|-------------|-------------|----------|---------------|-----------------------------------|
| `id`        | `UUID`      | NO       | (FK → auth.users) | Primary key, matches auth user ID |
| `email`     | `TEXT`      | YES      |               | User's email address              |
| `full_name` | `TEXT`      | YES      |               | Display name                      |
| `role`      | `TEXT`      | YES      | `'customer'`  | `'customer'` or `'admin'`         |
| `created_at`| `TIMESTAMPTZ`| YES     | `now()`       | Account creation timestamp        |

---

### `products`

Master product catalog.

| Column          | Type        | Nullable | Default  | Description                           |
|-----------------|-------------|----------|----------|---------------------------------------|
| `id`            | `UUID`      | NO       | `gen_random_uuid()` | Primary key                  |
| `name`          | `TEXT`      | NO       |          | Product display name                  |
| `description`   | `TEXT`      | YES      |          | Full product description              |
| `price_inr`     | `NUMERIC`   | NO       |          | Base price in Indian Rupees (₹)       |
| `stock_qty`     | `INT`       | NO       | `0`      | Current inventory count               |
| `category`      | `TEXT`      | YES      |          | Product category (e.g., "Vitamins")   |
| `images`        | `JSONB`     | YES      | `'[]'`   | Array of image URLs                   |
| `highlights`    | `JSONB`     | YES      | `'[]'`   | Array of feature highlights           |
| `image_positions`| `JSONB`    | YES      | `'{}'`   | CSS `object-position` per image       |
| `is_active`     | `BOOLEAN`   | YES      | `true`   | Soft delete / visibility toggle       |
| `created_at`    | `TIMESTAMPTZ`| YES     | `now()`  | Creation timestamp                    |

---

### `product_variants`

Size/flavor variants attached to a product.

| Column          | Type        | Nullable | Default  | Description                    |
|-----------------|-------------|----------|----------|--------------------------------|
| `id`            | `UUID`      | NO       | `gen_random_uuid()` | Primary key           |
| `product_id`    | `UUID`      | NO       | (FK → products) | Parent product            |
| `label`         | `TEXT`      | NO       |          | Display label (e.g., "500ml") |
| `price_inr`     | `NUMERIC`   | YES      |          | Override price (if different) |
| `stock_qty`     | `INT`       | YES      | `0`      | Variant-specific stock        |
| `sku`           | `TEXT`      | YES      |          | SKU code                      |

---

### `orders`

Customer orders. Created by `place_order_cod` (COD) or `place_order_prepaid` (Razorpay) RPC functions.

| Column               | Type        | Nullable | Default  | Description                              |
|----------------------|-------------|----------|----------|------------------------------------------|
| `id`                 | `UUID`      | NO       | `gen_random_uuid()` | Primary key                     |
| `user_id`            | `UUID`      | NO       | (FK → profiles) | Customer who placed the order       |
| `status`             | `TEXT`      | NO       | `'placed'` | `placed` → `processing` → `shipped` → `out_for_delivery` → `delivered` / `cancelled` |
| `shipping_address`   | `JSONB`     | YES      |          | Full address object (see below)          |
| `total_inr`          | `NUMERIC`   | YES      |          | Order total in ₹                         |
| `total_items`        | `INT`       | YES      |          | Number of line items                     |
| `payment_method`     | `TEXT`      | YES      | `'cod'`  | `'cod'` or `'prepaid'`                   |
| `razorpay_payment_id`| `TEXT`      | YES      |          | Razorpay payment ID (prepaid only)       |
| `razorpay_order_id`  | `TEXT`      | YES      |          | Razorpay order ID (prepaid only)         |
| `created_at`         | `TIMESTAMPTZ`| YES     | `now()`  | Order placement timestamp                |

**`shipping_address` JSONB shape:**

```json
{
  "fullName": "John Doe",
  "phone": "9876543210",
  "line1": "123 Main Street",
  "line2": "Apt 4B",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001"
}
```

---

### `order_items`

Line items within an order. Created by the `place_order_*` RPC functions.

| Column           | Type        | Nullable | Default  | Description                     |
|------------------|-------------|----------|----------|---------------------------------|
| `id`             | `UUID`      | NO       | `gen_random_uuid()` | Primary key            |
| `order_id`       | `UUID`      | NO       | (FK → orders) | Parent order                |
| `product_id`     | `UUID`      | NO       | (FK → products) | Product reference         |
| `variant_id`     | `UUID`      | YES      | (FK → product_variants) | Variant (if any)  |
| `product_name`   | `TEXT`      | NO       |          | Snapshot of product name at order time |
| `variant_label`  | `TEXT`      | YES      |          | Snapshot of variant label        |
| `qty`            | `INT`       | NO       |          | Quantity ordered                 |
| `unit_price_inr` | `NUMERIC`   | NO       |          | Price per unit in ₹              |
| `line_total_inr` | `NUMERIC`   | YES      |          | `qty × unit_price_inr`           |

---

### `addresses`

Saved shipping addresses per user.

| Column    | Type        | Nullable | Default  | Description                   |
|-----------|-------------|----------|----------|-------------------------------|
| `id`      | `UUID`      | NO       | `gen_random_uuid()` | Primary key          |
| `user_id` | `UUID`      | NO       | (FK → profiles) | Owner                    |
| `fullName`| `TEXT`      | NO       |          | Recipient name                |
| `phone`   | `TEXT`      | NO       |          | 10-digit Indian mobile        |
| `line1`   | `TEXT`      | NO       |          | Address line 1                |
| `line2`   | `TEXT`      | YES      |          | Address line 2                |
| `city`    | `TEXT`      | NO       |          | City                          |
| `state`   | `TEXT`      | NO       |          | State                         |
| `pincode` | `TEXT`      | NO       |          | 6-digit PIN code              |

---

### `product_reviews`

Customer reviews attached to products.

| Column       | Type        | Nullable | Default  | Description                    |
|--------------|-------------|----------|----------|--------------------------------|
| `id`         | `UUID`      | NO       | `gen_random_uuid()` | Primary key           |
| `product_id` | `UUID`      | NO       | (FK → products) | Reviewed product          |
| `user_id`    | `UUID`      | NO       | (FK → profiles) | Reviewer                  |
| `order_id`   | `UUID`      | YES      | (FK → orders) | Order context               |
| `rating`     | `INT`       | NO       |          | 1–5 star rating               |
| `body`       | `TEXT`      | YES      |          | Review text                    |
| `created_at` | `TIMESTAMPTZ`| YES     | `now()`  | Submission timestamp           |

---

### `app_settings`

Key-value store for application configuration (CMS settings, feature flags).

| Column | Type   | Nullable | Description                                        |
|--------|--------|----------|----------------------------------------------------|
| `key`  | `TEXT` | NO       | Setting identifier (primary key)                   |
| `value`| `JSONB`| YES      | Setting value                                      |

**Notable keys:**

| Key                   | Value Type | Description                              |
|-----------------------|------------|------------------------------------------|
| `max_items_per_order` | `number`   | Maximum items allowed per order          |
| `razorpay_enabled`    | `boolean`  | Enables/disables the Razorpay payment option |
| `hero_images`         | `array`    | Homepage hero carousel images            |
| `hero_copy`           | `object`   | Homepage hero text (title, subtitle)     |
| `featured_ids`        | `array`    | Featured product IDs for homepage        |
| `pillars`             | `array`    | Brand pillars displayed on homepage      |
| `categories`          | `array`    | Category cards for homepage              |
| `philosophy`          | `object`   | Philosophy section content               |

---

### `wa_notifications`

Tracks WhatsApp notification sends to customers (used by admin).

| Column          | Type        | Nullable | Description                         |
|-----------------|-------------|----------|-------------------------------------|
| `order_id`      | `UUID`      | NO       | (FK → orders) — composite PK       |
| `status`        | `TEXT`      | NO       | Order status at send — composite PK |
| `phone`         | `TEXT`      | YES      | Customer phone number               |
| `customer_name` | `TEXT`      | YES      | Customer name                       |
| `sent_by`       | `TEXT`      | YES      | Admin email who triggered the send  |
| `sent_at`       | `TIMESTAMPTZ`| YES     | `now()`                             |

---

## RPC Functions

> **Security:** All order RPCs enforce `auth.uid()` checks and validate coupon codes server-side.

### `place_order_cod(p_user_id, p_address, p_items, p_coins_used, p_shipping, p_gst, p_discount, p_coupon_code)`

Places a **Cash on Delivery** order.

| Parameter       | Type      | Description                                        |
|----------------|---------- |----------------------------------------------------|
| `p_user_id`    | `UUID`    | Must match `auth.uid()` — enforced                 |
| `p_address`    | `JSONB`   | Shipping address object                            |
| `p_items`      | `JSONB`   | Array of `{ product_id, variant_id, qty }`         |
| `p_coins_used` | `INT`     | CoreCoins to deduct (default 0)                    |
| `p_shipping`   | `NUMERIC` | Pincode-based rate (used when flat rate = 0)       |
| `p_gst`        | `NUMERIC` | IGNORED — recalculated server-side                 |
| `p_discount`   | `NUMERIC` | IGNORED — recalculated from coupon server-side     |
| `p_coupon_code`| `TEXT`    | Coupon code — validated server-side via `app_settings` |

**What it does:**
1. **Auth guard:** Rejects if `p_user_id ≠ auth.uid()`
2. Loads GST%, shipping, free-shipping config from `app_settings`
3. Deducts CoreCoins from wallet (if used)
4. **Server-side coupon validation:** Looks up `p_coupon_code` in `discount_codes`, validates active + schedule
5. For each item: checks stock → deducts stock → inserts `order_items` (prices from DB)
6. Calculates shipping, GST, coupon discount, coin discount server-side
7. Returns the new `order_id` (UUID)

---

### `place_order_prepaid(p_user_id, p_address, p_items, p_payment_method, p_razorpay_payment_id, p_razorpay_order_id, p_coins_used, p_shipping, p_gst, p_discount, p_coupon_code)`

Places a **Razorpay prepaid** order. Called by the `verify-razorpay-payment` Edge Function after successful payment verification.

**Auth guard:** Allows service-role bypass (`auth.uid()` is NULL for service-role calls). Regular users are still checked.

**What it does:** Same as `place_order_cod` but additionally stores Razorpay payment IDs.

---

### `cancel_order(p_order_id, p_user_id)`

Cancels an order and restores product stock.

| Parameter    | Type   | Description              |
|-------------|--------|--------------------------|
| `p_order_id`| `UUID` | Order to cancel          |
| `p_user_id` | `UUID` | Owner verification       |

---

## Edge Functions

Located in `supabase/functions/`. Deployed to Supabase Edge (Deno runtime).

> **CORS:** All Edge Functions use a shared `_shared/cors.ts` utility that restricts `Access-Control-Allow-Origin` to allowed domains: `coreatoms.in`, `www.coreatoms.in`, `core-atoms.vercel.app`, `*.vercel.app` (previews), and `localhost`. Update `_shared/cors.ts` if domains change.

### `_shared/cors.ts`

Shared CORS utility imported by all Edge Functions. Exports:
- `getCorsHeaders(req)` — returns CORS headers with validated origin
- `handleCorsPreflightRequest(req)` — returns 200 OK with CORS headers

### `create-razorpay-order`

**Path:** `supabase/functions/create-razorpay-order/index.ts`  
**Purpose:** Creates a Razorpay order via their API. Called before opening the checkout popup.

| Request Body | Type     | Description                     |
|-------------|----------|---------------------------------|
| `amount`    | `number` | Amount in **paise** (₹1 = 100) |
| `receipt`   | `string` | Unique receipt ID (max 40 chars)|

| Response     | Type     | Description               |
|-------------|----------|---------------------------|
| `id`        | `string` | Razorpay order ID         |
| `amount`    | `number` | Amount in paise           |
| `currency`  | `string` | `"INR"`                   |

**Secrets used:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`

---

### `verify-razorpay-payment`

**Path:** `supabase/functions/verify-razorpay-payment/index.ts`  
**Purpose:** Verifies the Razorpay payment signature (HMAC-SHA256), then creates the order in the database.

| Request Body            | Type     | Description                     |
|------------------------|----------|---------------------------------|
| `razorpay_order_id`    | `string` | From Razorpay callback          |
| `razorpay_payment_id`  | `string` | From Razorpay callback          |
| `razorpay_signature`   | `string` | From Razorpay callback          |
| `user_id`              | `string` | Authenticated user's UUID       |
| `address`              | `object` | Shipping address                |
| `items`                | `array`  | Cart items                      |

**What it does:**
1. Computes HMAC-SHA256 of `razorpay_order_id|razorpay_payment_id` using the secret key
2. Compares against `razorpay_signature` — rejects if mismatch
3. Calls `place_order_prepaid` RPC to create the order
4. Returns `{ success: true, order: <order_id> }`

**Secrets used:** `RAZORPAY_KEY_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### `delhivery-pincode-check`

**Path:** `supabase/functions/delhivery-pincode-check/index.ts`  
**Purpose:** Checks pincode serviceability and calculates shipping charges for both prepaid and COD.

| Request Body   | Type     | Description                          |
|---------------|----------|--------------------------------------|
| `pincode`     | `string` | 6-digit Indian pincode               |
| `weight_grams`| `number` | Package weight (optional, default 500) |

| Response                  | Type      | Description                                |
|--------------------------|-----------|--------------------------------------------|
| `serviceable`            | `boolean` | Whether pincode is deliverable             |
| `cod`                    | `boolean` | COD available for this pincode             |
| `prepaid`                | `boolean` | Prepaid available for this pincode         |
| `shipping_charge`        | `number`  | Prepaid rate (backward compat)             |
| `shipping_charge_prepaid`| `number`  | Express prepaid rate (`md=E`)              |
| `shipping_charge_cod`    | `number`  | Express + COD surcharge (`md=E&pt=COD`)    |
| `estimated_days`         | `string`  | e.g. `"3–5"`                               |

**Secrets used:** `DELHIVERY_TOKEN`, `DELHIVERY_BASE_URL`, `DELHIVERY_WAREHOUSE_PIN`

### `delhivery-create-shipment`

**Path:** `supabase/functions/delhivery-create-shipment/index.ts`  
**Purpose:** Creates a Delhivery shipping waybill for an order.  
**Auth:** Requires admin role — verifies JWT and checks `profiles.role = 'admin'`. Returns 403 for non-admins.

---

## Razorpay Payment Flow

End-to-end payment flow from checkout to order confirmation:

```
 Customer clicks "Pay Now"
         │
         ▼
 ┌───────────────────────────────┐
 │  1. Frontend calculates       │
 │     amount in paise           │
 │     (e.g., ₹500 → 50000)     │
 └──────────────┬────────────────┘
                │
                ▼
 ┌───────────────────────────────┐
 │  2. supabase.functions.invoke │
 │     ("create-razorpay-order") │
 │     → calls Razorpay API      │
 │     → returns order_id        │
 └──────────────┬────────────────┘
                │
                ▼
 ┌───────────────────────────────┐
 │  3. Razorpay Checkout popup   │
 │     opens with order_id       │
 │     → Customer enters card /  │
 │       UPI / net banking       │
 └──────────────┬────────────────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
   [Success]         [Dismiss]
       │                 │
       ▼                 ▼
 ┌─────────────┐   ┌───────────┐
 │ 4. onSuccess│   │ Show      │
 │    callback │   │ "cancelled│
 │    with:    │   │  " toast  │
 │  • order_id │   └───────────┘
 │  • payment_id│
 │  • signature│
 └──────┬──────┘
        │
        ▼
 ┌───────────────────────────────┐
 │  5. supabase.functions.invoke │
 │     ("verify-razorpay-payment")│
 │     → HMAC signature check    │
 │     → place_order_prepaid()   │
 │     → order created in DB     │
 └──────────────┬────────────────┘
                │
                ▼
 ┌───────────────────────────────┐
 │  6. "Order placed!" screen    │
 │     → redirect to /orders     │
 └───────────────────────────────┘
```

### Security Model

- **Key ID** (`VITE_RAZORPAY_KEY_ID`) — public, safe for frontend
- **Key Secret** (`RAZORPAY_KEY_SECRET`) — **server-only**, stored in Supabase secrets
- **Signature verification** — ensures the payment callback is authentic and not tampered with
- **Edge Functions** are deployed with `--no-verify-jwt` to handle auth internally

---

## Row-Level Security (RLS)

All tables have RLS enabled. Key policies:

| Table            | Policy                                              |
|-----------------|-----------------------------------------------------|
| `profiles`       | Users can read/update their own profile             |
| `products`       | Public read; admin-only write                       |
| `product_variants`| Public read; admin-only write                      |
| `orders`         | Users see only their own orders; admin sees all     |
| `order_items`    | Users see items for their own orders                |
| `addresses`      | Users CRUD only their own addresses                 |
| `product_reviews`| Public read; users can insert for their own orders  |
| `app_settings`   | **Granular read:** sensitive keys (`discount_codes`, `warehouse_address`) require authentication; all other keys are publicly readable. Admin-only write. |

> **Note:** RPC functions (`place_order_cod`, `place_order_prepaid`, `cancel_order`) are defined as `SECURITY DEFINER`, meaning they execute with the function owner's privileges (bypassing RLS). This allows them to deduct stock across all products. However, they still enforce `auth.uid()` checks internally to prevent impersonation.

---

## Environment Variables & Secrets

### Frontend (`.env.local`)

| Variable                | Required | Description                                    |
|------------------------|----------|------------------------------------------------|
| `VITE_SUPABASE_URL`    | ✅       | Supabase project URL                           |
| `VITE_SUPABASE_ANON_KEY`| ✅      | Supabase publishable anon key                  |
| `VITE_RAZORPAY_KEY_ID` | Optional | Razorpay Key ID (enables "Pay Now" button)     |

### Supabase Secrets (set via Dashboard or CLI)

| Secret                    | Required | Description                                  |
|--------------------------|----------|----------------------------------------------|
| `RAZORPAY_KEY_ID`        | For payments | Razorpay API Key ID                      |
| `RAZORPAY_KEY_SECRET`    | For payments | Razorpay API Key Secret (**never expose**)|
| `DELHIVERY_TOKEN`        | For shipping | Delhivery API token                      |
| `DELHIVERY_BASE_URL`     | For shipping | `https://track.delhivery.com` (production)|
| `DELHIVERY_WAREHOUSE_PIN`| For shipping | Origin warehouse pincode (optional)      |
| `SUPABASE_URL`           | Auto-set | Project URL (auto-available in Edge Functions)|
| `SUPABASE_SERVICE_ROLE_KEY`| Auto-set | Service role key (auto-available)          |

---

## Migrations

SQL migration files in `supabase/migrations/`:

### `add_razorpay_columns.sql`

Adds Razorpay payment support to the existing schema:

1. **Adds columns** to `orders` table:
   - `payment_method` (TEXT, default `'cod'`)
   - `razorpay_payment_id` (TEXT, nullable)
   - `razorpay_order_id` (TEXT, nullable)

2. **Creates** the `place_order_prepaid` RPC function

3. **Inserts** the `razorpay_enabled` key into `app_settings`

### `create_wa_notifications.sql`

Creates the `wa_notifications` table for tracking WhatsApp notification sends.

---

## Deployment

### Edge Functions

Deploy using the Supabase CLI (project is linked — no `--project-ref` needed):

```bash
# Deploy all Edge Functions at once
supabase functions deploy --no-verify-jwt

# Deploy a single function
supabase functions deploy create-razorpay-order --no-verify-jwt
supabase functions deploy verify-razorpay-payment --no-verify-jwt
supabase functions deploy delhivery-create-shipment --no-verify-jwt
supabase functions deploy delhivery-pincode-check --no-verify-jwt
supabase functions deploy delhivery-track --no-verify-jwt
```

> **`--no-verify-jwt`** is required because the Supabase gateway JWT verification may not support all key formats. Edge Functions handle authentication internally (e.g., `delhivery-create-shipment` verifies admin role).

### Setting Secrets

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxx RAZORPAY_KEY_SECRET=xxx --project-ref <project-ref>
```

### Running Migrations

Execute migration SQL files in the **Supabase Dashboard → SQL Editor**, or via the CLI:

```bash
supabase db push --project-ref <project-ref>
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Edge Function returns 502 | Old `deno.land/std` imports or boot failure | Use `Deno.serve()` (built-in), avoid external Deno imports |
| "receipt: the length must be no more than 40" | Receipt string exceeds Razorpay's 40-char limit | Shorten receipt to ≤40 characters |
| "column X does not exist" in RPC | `place_order_prepaid` has wrong column names | Ensure RPC matches the actual `orders` table schema |
| Payment succeeds but order fails | `verify-razorpay-payment` errors during order creation | Check Supabase Edge Function logs for the specific DB error |
| "Pay Now" button not showing | `razorpay_enabled` is false or `VITE_RAZORPAY_KEY_ID` is missing | Enable in Admin Settings + add env var |
| Edge Function "Invalid JWT" | Gateway rejects the anon key format | Redeploy with `--no-verify-jwt` flag |

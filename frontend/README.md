# Core Atoms — Nutraceutical E-commerce Platform

> Premium Indian nutraceutical brand. Full-stack web application with a React frontend, Supabase backend, Razorpay payments, Delhivery logistics, and a CoreCoins loyalty programme.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Supabase (PostgreSQL + RLS + Auth + Storage) |
| Edge Functions | Supabase Edge Functions (Deno / TypeScript) |
| Payments | Razorpay (COD + online prepaid) |
| Logistics | Delhivery API (pincode check, shipment creation, tracking) |
| Deployment | Vercel (frontend), Supabase Cloud (backend) |

---

## Features

### Customer-Facing
- Product catalogue with search, category filter, variants (size/pack)
- Product detail page with image gallery, reviews, pincode delivery check
- Cart with CoreCoins redemption toggle
- Checkout with:
  - Saved addresses (CRUD)
  - Pincode-based OR flat-rate shipping (from admin settings)
  - GST calculation (configurable %)
  - Coupon code discounts
  - COD and Razorpay online payment
  - Itemised order receipt shown on success
- My Orders with:
  - Full bill breakdown (items, shipping, GST, coins)
  - Order tracking timeline + live Delhivery tracking
  - Product review submission (post-delivery)
  - Replacement request (photo upload)
  - Failed payment visibility with retry option
- CoreCoins loyalty: earn coins on delivery, redeem at checkout (₹1/coin)

### Admin Dashboard
- **Products**: Full CRUD — name, SKU, category, description, price, stock, images, variants, highlights, SEO
- **Orders**: View all orders with full payment breakdown; update status; ship via Delhivery (generates waybill + tracking URL); view COD vs prepaid
- **Settings** (accordion UI):
  - Shipping: flat rate or Delhivery pincode-based, free shipping threshold
  - GST: configurable percentage (or 0 for none)
  - Payments: toggle Razorpay / COD independently
  - Discount codes: add codes with % off, date range, active flag
  - Replacements: enable feature + configure replacement window (days or minutes)
  - CoreCoins: enable/disable + configure earn rate, coin value, min redeem
  - Promo Banner: floating announcement bar with custom text, link, colours
- **Homepage CMS**: Hero carousel (images + focal point adjuster), copy, pillars, category shortcuts, philosophy section, featured products
- **CoreCoins Wallet**: Paginated view of all customer wallets and balances
- **Replacements**: Review, approve/reject, initiate reverse pickup + replacement shipment via Delhivery
- **Reviews**: Moderate all product reviews

---

## Quick Start

### Prerequisites
- Node.js 18+
- A Supabase project
- (Optional) Razorpay account
- (Optional) Delhivery API access

### 1. Clone & Install
```bash
git clone https://github.com/your-org/coreatoms.git
cd coreatoms/frontend
npm install
```

### 2. Environment Variables
Copy `.env.local.example` to `.env.local` and fill in:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_RAZORPAY_KEY_ID=rzp_live_xxx   # Optional — leave blank to hide online payments
```

### 3. Database Setup
Open **Supabase Dashboard → SQL Editor** and run the single master schema file:
```
supabase/migrations/master_schema.sql
```
This creates all tables, RLS policies, indexes, triggers, and stored procedures. It is **idempotent** — safe to re-run.

After running SQL, create storage buckets in Supabase Dashboard → Storage:
- `hero-images` (public)
- `product-images` (public)
- `replacement-images` (public, 5 MB limit, jpg/png/webp only)

### 4. Set your first Admin user
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

### 5. Deploy Edge Functions (if using Razorpay / Delhivery)
```bash
npx supabase functions deploy create-razorpay-order
npx supabase functions deploy verify-razorpay-payment
npx supabase functions deploy delhivery-pincode-check
npx supabase functions deploy delhivery-create-shipment
npx supabase functions deploy delhivery-track
```
Set secrets in Supabase Dashboard → Settings → Edge Functions:
```
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
DELHIVERY_TOKEN, DELHIVERY_CLIENT_NAME
```

### 6. Run locally
```bash
npm run dev
```

---

## Project Structure

```
src/
├── components/       # Reusable UI — Navbar, Footer, ProductCard, OrderTimeline, etc.
├── context/          # AuthContext, CartContext, ToastContext
├── hooks/            # useDebounce, etc.
├── layouts/          # AppLayout (Navbar + outlet + Footer)
├── pages/            # Page-level components
│   └── admin/        # AdminDashboard, AdminOrders, AdminProducts, AdminSettings, …
├── routes/           # React Router setup + protected route HOC
├── services/         # Supabase query helpers, Razorpay loader
├── utils/            # money() formatter, date helpers
└── index.css         # Tailwind + custom classes (.btn-primary, .card, .card-shine, …)

supabase/
├── functions/        # Edge Functions (Deno)
└── migrations/
    └── master_schema.sql   ← SINGLE SOURCE OF TRUTH

.project/
└── PROJECT_KNOWLEDGE.md    ← Comprehensive AI/engineer onboarding doc
```

---

## Database at a Glance

| Table | Description |
|---|---|
| `profiles` | User accounts + role (customer/admin) |
| `products` | Product catalogue with stock |
| `product_images` | Gallery images per product |
| `product_variants` | Size/pack variants |
| `product_reviews` | Star ratings + text |
| `user_addresses` | Saved delivery addresses |
| `replacements` | Product replacement requests |
| `orders` | Orders with full financial breakdown |
| `order_items` | Snapshotted line items per order |
| `app_settings` | Admin key-value config store |
| `corecoins_wallet` | Loyalty coin balance per user |


---

## Key Design Decisions

- **No separate API server.** All backend logic is in PostgreSQL RPCs and Supabase Edge Functions.
- **`place_order_cod` / `place_order_prepaid` RPCs** are the only safe way to create orders. They atomically check stock, deduct inventory, calculate the correct total, and persist coupon discount information.
- **Monetary values** are stored as `numeric(10,2)` INR. Never calculated client-side and trusted by the DB — the server recalculates the final total.
- **GST is applied on items only**, not on shipping.
- **CoreCoins are earned after delivery**, not after payment, and deferred by the replacement window (if enabled). Window can be configured in days or minutes (minutes override days when > 0).
- **Shipping is either flat-rate or Delhivery pincode-based**, never both. 0 in `shipping_amount.amount` = pincode mode.

---

## Onboarding a New AI Assistant

Point the AI to: **`.project/PROJECT_KNOWLEDGE.md`** — this single file contains the full architecture, data model, business logic, checkout flow, all RPCs, Edge Functions, component catalogue, and critical gotchas.

---

## Licence
Private / proprietary. All rights reserved — Core Atoms.

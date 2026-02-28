# Core Atoms — E-Commerce Platform

> A full-stack nutraceutical e-commerce platform built with **React + Vite** on the frontend and **Supabase** (PostgreSQL, Auth, Edge Functions, Storage) on the backend. Includes an admin dashboard, Delhivery shipping integration, Razorpay payments, and a product replacement workflow.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Frontend Architecture](#frontend-architecture)
- [Backend — Supabase](#backend--supabase)
- [Edge Functions](#edge-functions)
- [Database Schema](#database-schema)
- [Admin Dashboard](#admin-dashboard)
- [Key Workflows](#key-workflows)
- [Deployment](#deployment)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Vite + React)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Pages   │ │Components│ │ Context  │ │   Services   │   │
│  │  (10+6)  │ │   (18)   │ │Auth/Cart │ │products,orders│  │
│  └──────────┘ └──────────┘ │  Toast   │ │razorpay,addr │   │
│                            └──────────┘ └──────┬───────┘   │
└─────────────────────────────────────────────────┼───────────┘
                                                  │
                                    Supabase JS Client
                                                  │
┌─────────────────────────────────────────────────┼───────────┐
│                  SUPABASE BACKEND                │           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┴─────┐    │
│  │PostgreSQL│ │   Auth   │ │ Storage  │ │   Edge     │    │
│  │ 11 tables│ │ Email/OTP│ │ Buckets  │ │ Functions  │    │
│  │  + RLS   │ │ Profiles │ │ Images   │ │ 5 endpoints│    │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘    │
│                                          ┌────────────┐    │
│                                          │ Delhivery  │    │
│                                          │ Razorpay   │    │
│                                          │   APIs     │    │
│                                          └────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer        | Technology                              |
|--------------|----------------------------------------|
| **Frontend** | React 18, Vite 7, TailwindCSS 4        |
| **Routing**  | react-router-dom v7 (data router)       |
| **State**    | React Context (Auth, Cart, Toast)       |
| **Backend**  | Supabase (PostgreSQL, Auth, Storage)    |
| **Edge Fns** | Deno runtime (Supabase Edge Functions)  |
| **Payments** | Razorpay (COD + online)                |
| **Shipping** | Delhivery (create, track, pincode)     |
| **SEO**      | react-helmet-async                     |
| **Deploy**   | Vercel (frontend), Supabase (backend)  |

---

## Project Structure

```
frontend/
├── src/
│   ├── main.jsx                    # App entry — provider hierarchy
│   ├── index.css                   # Global styles + Tailwind
│   ├── assets/                     # Static assets (logo, etc.)
│   ├── components/                 # 18 reusable UI components
│   │   ├── Navbar.jsx              #   Site navigation + auth state
│   │   ├── Footer.jsx              #   Site footer
│   │   ├── ProductCard.jsx         #   Product display card
│   │   ├── ProductGrid.jsx         #   Grid layout for products
│   │   ├── HeroCarousel.jsx        #   Homepage hero image carousel
│   │   ├── ShipmentTracker.jsx     #   Delhivery live tracking UI
│   │   ├── PincodeChecker.jsx      #   Pincode serviceability checker
│   │   ├── OrderTimeline.jsx       #   Visual order status timeline
│   │   ├── ImagePositionAdjuster.jsx # Admin image crop/position tool
│   │   ├── FloatingShapes.jsx      #   Decorative background shapes
│   │   ├── ScrollReveal.jsx        #   Scroll-triggered animations
│   │   ├── Skeleton.jsx            #   Loading skeleton components
│   │   ├── Toast.jsx               #   Toast notification display
│   │   ├── Button.jsx              #   Reusable button component
│   │   ├── ConfirmDialog.jsx       #   Confirmation modal dialog
│   │   ├── ErrorBoundary.jsx       #   React error boundary
│   │   ├── AdminSettingsCard.jsx   #   Settings card wrapper
│   │   └── SEO.jsx                 #   SEO meta tag helper
│   ├── context/                    # React context providers
│   │   ├── AuthContext.jsx         #   Auth state + profile + inactivity timeout
│   │   ├── CartContext.jsx         #   Cart CRUD + localStorage persistence
│   │   └── ToastContext.jsx        #   Toast notification manager
│   ├── hooks/                      # Custom React hooks
│   │   ├── useDebounce.js          #   Debounced value hook
│   │   ├── useDocumentTitle.js     #   Dynamic page title
│   │   ├── useFormValidation.js    #   Form validation helper
│   │   └── useKeyboardShortcut.js  #   Keyboard shortcut binding
│   ├── layouts/
│   │   └── MainLayout.jsx          #   Navbar + Outlet + Footer shell
│   ├── pages/                      # Page-level components
│   │   ├── Home.jsx                #   Landing page (hero, featured, pillars)
│   │   ├── Shop.jsx                #   Product listing with search/filter
│   │   ├── ProductDetail.jsx       #   Product page (variants, reviews, pincode)
│   │   ├── Cart.jsx                #   Shopping cart
│   │   ├── Checkout.jsx            #   Address + payment (COD/Razorpay/coupons)
│   │   ├── MyOrders.jsx            #   Order history + tracking + reviews
│   │   ├── Login.jsx               #   Email OTP authentication
│   │   ├── ErrorPage.jsx           #   Router error boundary
│   │   ├── NotFound.jsx            #   404 page
│   │   ├── AdminDashboard.jsx      #   Admin shell (tabs, stats)
│   │   └── admin/                  #   Admin sub-pages
│   │       ├── AdminProducts.jsx   #     CRUD products + variants + images
│   │       ├── AdminOrders.jsx     #     Order management + Delhivery ship
│   │       ├── AdminHomepage.jsx   #     Homepage content editor
│   │       ├── AdminReviews.jsx    #     Review moderation
│   │       ├── AdminReplacements.jsx #   Replacement request handling
│   │       └── AdminSettings.jsx   #     Feature toggles + discount codes
│   ├── routes/                     # Routing configuration
│   │   ├── AppRoutes.jsx           #   createBrowserRouter definitions
│   │   ├── ProtectedRoute.jsx      #   Auth guard (logged-in users)
│   │   └── AdminRoute.jsx          #   Admin guard (role === "admin")
│   ├── services/                   # Data access / API layer
│   │   ├── supabase/client.js      #   Supabase client singleton
│   │   ├── products.js             #   Product CRUD + DB→frontend mapping
│   │   ├── orders.js               #   Order queries, cancel, reviews
│   │   ├── addresses.js            #   Address CRUD
│   │   ├── homepage.js             #   Homepage settings fetch
│   │   ├── razorpay.js             #   Razorpay SDK loader + checkout
│   │   ├── errorReporter.js        #   Environment-aware error logging
│   │   └── api/                    #   Additional API utilities
│   ├── utils/
│   │   └── format.js               #   Currency formatting (₹)
│   └── data/
│       └── products.seed.json      #   Sample product seed data
├── supabase/
│   ├── functions/                  # Edge Functions (Deno runtime)
│   │   ├── delhivery-create-shipment/  # Create forward/reverse/exchange shipments
│   │   ├── delhivery-track/            # Track shipment by waybill
│   │   ├── delhivery-pincode-check/    # Pincode serviceability check
│   │   ├── create-razorpay-order/      # Create Razorpay payment order
│   │   └── verify-razorpay-payment/    # Verify signature + create order
│   └── migrations/                 # SQL migrations
│       ├── add_delhivery_columns.sql
│       ├── add_razorpay_columns.sql
│       ├── add_replacements_table.sql
│       ├── add_replacement_tracking_columns.sql
│       └── create_wa_notifications.sql
├── SQL DB Backup/
│   └── core_atoms_schema_backup.sql  # Full schema export
├── package.json
├── vite.config.js
├── tailwind.config.js
├── vercel.json                     # Vercel rewrite rules (SPA)
├── .env.local                      # Environment variables (not committed)
└── .env.local.example              # Template for env vars
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- A Supabase project (free tier works)
- Delhivery API credentials (for shipping)
- Razorpay Key ID + Secret (for online payments)

### Installation

```bash
git clone <repo-url>
cd frontend
npm install
cp .env.local.example .env.local   # Fill in your Supabase + Razorpay keys
```

### Run the schema

Run the SQL files in your Supabase SQL Editor in this order:

1. `SQL DB Backup/core_atoms_schema_backup.sql` — Core tables, RLS, triggers
2. `supabase/migrations/add_delhivery_columns.sql` — Shipping columns
3. `supabase/migrations/add_razorpay_columns.sql` — Payment columns + RPC
4. `supabase/migrations/add_replacements_table.sql` — Replacements table
5. `supabase/migrations/add_replacement_tracking_columns.sql` — Tracking columns
6. `supabase/migrations/create_wa_notifications.sql` — WhatsApp tracking

### Development

```bash
npm run dev      # Start Vite dev server (port 5173)
npm run build    # Production build
npm run preview  # Preview production build
```

### Deploy Edge Functions

```bash
supabase functions deploy delhivery-create-shipment
supabase functions deploy delhivery-track
supabase functions deploy delhivery-pincode-check
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
```

---

## Environment Variables

Create `.env.local` with:

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_RAZORPAY_KEY_ID=<razorpay-key-id>
```

### Supabase Edge Function Secrets

Set these via Supabase Dashboard → Edge Functions → Secrets:

| Secret                         | Description                              |
|--------------------------------|------------------------------------------|
| `DELHIVERY_API_TOKEN`          | Delhivery API authentication token       |
| `DELHIVERY_BASE_URL`           | `https://track.delhivery.com` (prod)     |
| `DELHIVERY_CLIENT_NAME`        | Your Delhivery client/account name       |
| `DELHIVERY_PICKUP_NAME`        | Pickup location name                     |
| `RAZORPAY_KEY_ID`              | Razorpay Key ID (backend copy)           |
| `RAZORPAY_KEY_SECRET`          | Razorpay Key Secret (**never on frontend**) |
| `SUPABASE_URL`                 | Auto-set by Supabase                     |
| `SUPABASE_SERVICE_ROLE_KEY`    | Auto-set by Supabase                     |

---

## Frontend Architecture

### Provider Hierarchy

```
StrictMode → HelmetProvider → AuthProvider → CartProvider → ToastProvider → RouterProvider
```

### Route Map

| Path             | Component        | Guard            | Description                              |
|------------------|------------------|------------------|------------------------------------------|
| `/`              | `Home`           | Admin redirect   | Landing page with hero, products, pillars |
| `/shop`          | `Shop`           | Public           | Product listing with search + filters     |
| `/product/:id`   | `ProductDetail`  | Public           | Product details, variants, reviews        |
| `/cart`          | `Cart`           | Public           | Shopping cart                             |
| `/checkout`      | `Checkout`       | `ProtectedRoute` | Address + payment flow                    |
| `/orders`        | `MyOrders`       | `ProtectedRoute` | Order history + tracking + reviews        |
| `/login`         | `Login`          | Public           | Email OTP authentication                  |
| `/admin`         | `AdminDashboard` | `AdminRoute`     | Admin dashboard (6 tabs)                  |
| `*`              | `NotFound`       | —                | 404 page                                 |

### Context Providers

| Context        | Purpose                                                    |
|----------------|------------------------------------------------------------|
| `AuthContext`  | Supabase auth session, profile fetch with retry, admin role detection, 1-hour inactivity timeout |
| `CartContext`  | Cart CRUD, localStorage persistence, max-item enforcement from `app_settings` |
| `ToastContext` | Global toast notifications with auto-dismiss               |

### Service Layer

| Service           | Supabase Tables Used                | Purpose                           |
|-------------------|-------------------------------------|-----------------------------------|
| `products.js`     | `products`, `product_images`, `product_variants`, `product_reviews` | Product listing + detail fetch, DB→frontend mapping |
| `orders.js`       | `orders`, `order_items`, `product_reviews` | Order queries, cancellation (RPC), review submission |
| `addresses.js`    | `addresses`                         | Saved address CRUD                |
| `homepage.js`     | `app_settings`                      | Homepage content settings fetch   |
| `razorpay.js`     | —                                   | Razorpay SDK dynamic loader + checkout popup |
| `errorReporter.js`| —                                   | Dev/prod error logging            |

---

## Edge Functions

All Edge Functions run in the **Deno runtime** on Supabase.

| Function                     | Method | Purpose                                      |
|------------------------------|--------|----------------------------------------------|
| `delhivery-create-shipment`  | POST   | Creates forward, reverse pickup, or exchange shipments via Delhivery API. Accepts `warehouse` from request body (admin-configured) with env var fallback. |
| `delhivery-track`            | POST   | Fetches real-time tracking scans for a waybill number. Normalizes Delhivery response into a clean timeline. |
| `delhivery-pincode-check`    | POST   | Checks if a 6-digit Indian pincode is serviceable. Returns COD/prepaid availability, estimated delivery days, metro/ODA classification. |
| `create-razorpay-order`      | POST   | Creates a Razorpay order (amount in paise). Returns `{ id, amount, currency }`. |
| `verify-razorpay-payment`    | POST   | Verifies Razorpay HMAC-SHA256 signature, then calls `place_order_prepaid` RPC to create the order in the database. Uses service role key. |

---

## Database Schema

All tables live in the `public` schema with **Row Level Security (RLS)** enabled. See `supabase/migrations/000_full_schema.sql` for the complete creation script.

### Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User profiles (mirrors `auth.users`) | `id` (FK → auth.users), `full_name`, `role` (customer/admin) |
| `products` | Product catalog | `name`, `sku`, `category`, `price_inr`, `stock_qty`, `image_url`, `highlights` (jsonb), `about_text`, `best_for` |
| `product_images` | Gallery images per product | `product_id` (FK), `image_url`, `sort_order` |
| `product_variants` | Size/pack variants | `product_id` (FK), `label`, `price_inr`, `stock_qty`, `sku` |
| `product_reviews` | Customer reviews (1–5 stars) | `product_id`, `user_id`, `order_id`, `rating`, `title`, `body` |
| `orders` | Customer orders | `user_id`, `status`, shipping fields, `payment_method`, `delhivery_waybill`, `razorpay_payment_id` |
| `order_items` | Line items per order | `order_id`, `product_id`, `variant_id`, `qty`, `unit_price_inr` |
| `addresses` | Saved delivery addresses | `user_id`, `full_name`, `phone`, `line1/2`, `city`, `state`, `pincode` |
| `replacements` | Replacement requests | `order_id`, `user_id`, `reason`, `images[]`, `status`, `replacement_waybill`, `reverse_waybill` |
| `app_settings` | Key-value config store | `key` (PK), `value` (jsonb) — stores homepage content, feature toggles, discount codes, warehouse address |
| `wa_notifications` | WhatsApp notification log | `order_id`, `status`, `phone`, `sent_at` |

### `app_settings` Keys

| Key                          | Value Type      | Purpose                                |
|------------------------------|-----------------|----------------------------------------|
| `homepage_hero_images`       | `jsonb[]`       | Hero carousel images                   |
| `homepage_hero_copy`         | `jsonb`         | Hero headline, body, CTAs, trust icons |
| `homepage_featured_products` | `uuid[]`        | Featured product IDs                   |
| `homepage_pillars`           | `jsonb[]`       | Brand pillar cards                     |
| `homepage_categories`        | `jsonb[]`       | Category quick-links                   |
| `homepage_philosophy`        | `jsonb`         | Philosophy section copy                |
| `site_logo`                  | `string`        | Logo image URL                         |
| `shipping_amount`            | `jsonb`         | `{ amount: number }`                   |
| `max_order_items`            | `jsonb`         | `{ max: number }`                      |
| `razorpay_enabled`           | `jsonb`         | `{ enabled: boolean }`                 |
| `cod_enabled`                | `jsonb`         | `{ enabled: boolean }`                 |
| `replacements_enabled`       | `jsonb`         | `{ enabled: boolean }`                 |
| `discount_codes`             | `jsonb[]`       | Array of `{ code, percentage, active, startsAt?, endsAt?, emails? }` |
| `warehouse_address`          | `jsonb`         | `{ name, phone, address, city, state, pin }` |

### RPC Functions

| Function               | Purpose                                    |
|------------------------|--------------------------------------------|
| `place_order_cod`      | Creates a COD order with stock deduction   |
| `place_order_prepaid`  | Creates a prepaid order with Razorpay IDs  |
| `cancel_order`         | Cancels an order and restores stock        |
| `is_admin()`           | Helper: checks if current user is admin    |
| `handle_new_user()`    | Trigger: auto-creates profile on signup    |

### Storage Buckets

| Bucket              | Public | Purpose                          |
|---------------------|--------|----------------------------------|
| `hero-images`       | Yes    | Homepage hero carousel images    |
| `product-images`    | Yes    | Product gallery images           |
| `replacement-images`| Yes    | Damage photos for replacements   |

---

## Admin Dashboard

The admin dashboard (`/admin`) is a single-page shell with persistent tabs. Admin access requires `profiles.role = 'admin'`.

| Tab              | Component               | Features                                           |
|------------------|-------------------------|----------------------------------------------------|
| **Products**     | `AdminProducts.jsx`     | Full CRUD, variant management, image gallery, stock editing, image position adjustment |
| **Orders**       | `AdminOrders.jsx`       | Status pipeline, Delhivery integration, CSV export, WhatsApp notifications, bulk actions |
| **Homepage**     | `AdminHomepage.jsx`     | Visual editor for hero, pillars, categories, philosophy, featured products |
| **Reviews**      | `AdminReviews.jsx`      | Review moderation and deletion                     |
| **Replacements** | `AdminReplacements.jsx` | Approve/reject requests, ship replacements, reverse pickups, exchange workflow |
| **Settings**     | `AdminSettings.jsx`     | Feature toggles (COD, Razorpay, replacements), shipping amount, max items, discount codes (with scheduling + email restriction), warehouse address |

---

## Key Workflows

### Order Flow

```
Customer places order → status: "placed"
  Admin → "processing" → "shipped" (Delhivery waybill assigned)
    → "delivered" (confirmed via tracking)
  OR → "cancelled" (stock restored via RPC)
```

### Payment Flow

```
COD:      Checkout → place_order_cod RPC → order created
Razorpay: Checkout → create-razorpay-order Edge Fn → Razorpay popup
          → verify-razorpay-payment Edge Fn → HMAC verify → place_order_prepaid RPC
```

### Replacement Flow

```
Customer submits request (reason + photos) → status: "pending"
  Admin approves → "approved"
    → Ship Directly (Prepaid mode) → "replacement_shipped"
    → Reverse Pickup → "pickup_scheduled" → "pickup_received" → Ship → "replacement_shipped"
    → Exchange (REPL mode) → "replacement_shipped"
  Admin rejects → "rejected"
```

### Discount Codes

```
Admin creates code → { code, percentage, active, startsAt?, endsAt?, emails? }
Customer applies at checkout → validates: active + schedule + email restriction
Session-stored coupon re-validated on every page load
```

---

## Deployment

### Frontend (Vercel)

The `vercel.json` rewrites all routes to `index.html` for SPA routing:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

### Backend (Supabase)

1. Run all migration SQL files in order
2. Deploy Edge Functions via `supabase functions deploy <name>`
3. Set all secrets in Supabase Dashboard → Edge Functions → Secrets
4. Create storage buckets (hero-images, product-images, replacement-images) with public access

---

## License

Private repository — all rights reserved.

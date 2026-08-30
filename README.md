# Core Atoms

Nutraceutical e-commerce platform for the Indian market — a customer storefront, an admin dashboard, and a
mobile app, all sharing one Supabase backend. COD and Razorpay payments, Delhivery logistics, GST handling,
coupons, and a CoreCoins loyalty programme.

## Repository layout

| Path | What it is |
|---|---|
| `frontend/` | React 19 + Vite 8 + Tailwind v4 web app — customer storefront and the `/admin` dashboard in the same build |
| `mobile/` | Expo SDK 54 / React Native customer app (Android + iOS). No admin surface |
| `frontend/supabase/` | `master_schema.sql` and the payment + Delhivery Edge Functions |
| `supabase/` | The tree the Supabase CLI is linked to: timestamped migrations and the push-notification Edge Function |

There is no separate API server. Clients talk to Supabase directly through the JS SDK, and anything that must be
atomic or authoritative (order placement, cancellation, coupon and GST maths) runs as a Postgres RPC.

## Getting started

### Web

```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in the values below
npm run dev                        # http://localhost:5173
```

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_RAZORPAY_KEY_ID=              # optional in dev
```

Other scripts: `npm run build` (→ `dist/`), `npm run lint`, `npm run preview`.

### Mobile

```bash
cd mobile
npm install
cp .env.example .env
npx expo start                     # scan the QR code with Expo Go
```

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_RAZORPAY_KEY_ID=
```

COD works in Expo Go. Razorpay and push notifications need a native build (`npx expo prebuild`, then a dev
build on a physical device).

### Database

```bash
npx supabase db push                              # apply supabase/migrations
npx supabase functions deploy <function-name>     # deploy an Edge Function
```

## Architecture

**Backend.** Supabase provides Postgres, RLS, Auth, Storage and Edge Functions. Order placement goes through
`place_order_cod` or `place_order_prepaid`, which re-derive price, GST, shipping and coupon discount from the
database rather than trusting the client. `cancel_order` and `process_pending_corecoins` cover the rest of the
order lifecycle.

Edge Functions: `create-razorpay-order` and `verify-razorpay-payment` for payments; `delhivery-pincode-check`,
`delhivery-create-shipment` and `delhivery-track` for logistics; `send-order-notification` for Expo push.

**Web.** React Router v7 data router with lazy-loaded pages under a `MainLayout` shell. State is Context only —
`AuthContext`, `CartContext`, `ToastContext`. Admin pages live at `/admin`, gated on `profiles.role = 'admin'`.

**Mobile.** Bottom tabs (Home, Shop, Cart, Orders, Profile) with Login as a modal; Orders, Profile and Checkout
are auth-gated. Services mirror the web ones so both clients share the same queries and product shape.

**Live updates.** Home, Shop and My Orders subscribe to `postgres_changes` so admin edits appear without a
refresh, and an `orders.status` change fires a trigger that pushes a notification to the customer's device.

## Business logic

- **GST** — the warehouse is in Andhra Pradesh, so intra-state orders split into CGST + SGST and inter-state
  orders charge IGST. GST applies to the items subtotal only; shipping is GST-free.
- **Shipping** — a pincode-based Delhivery rate where available, otherwise the flat rate from `app_settings`,
  waived above the free-shipping threshold.
- **CoreCoins** — earned on delivery (deferred until the replacement window closes), redeemable at checkout.
- **Coupons** — stored in `app_settings.discount_codes` and re-validated server-side inside the order RPC.

## Documentation

- `CLAUDE.md` — conventions and architecture notes for working in this repo
- `frontend/.project/PROJECT_KNOWLEDGE.md` — full schema, RPCs, component catalogue and business-logic edge cases

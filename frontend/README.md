# Core Atoms — Frontend

E-commerce storefront for **Core Atoms** (premium nutraceuticals).  
Built with **React 19 + Vite + Tailwind CSS v4 + Supabase**.

---

## Quick Start

```bash
# 1 — Install dependencies
npm install

# 2 — Create .env.local with your Supabase credentials
cp .env.local.example .env.local   # then fill in your keys

# 3 — Start dev server (http://localhost:5173)
npm run dev
```

### Environment Variables

| Variable                  | Description                       |
|--------------------------|-----------------------------------|
| `VITE_SUPABASE_URL`      | Supabase project URL              |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable (anon) key   |

> Both must be set in `.env.local`. The app will throw a clear error on start if either is missing.

---

## Tech Stack

| Layer      | Technology                                  |
|-----------|---------------------------------------------|
| Framework | React 19 (with react-router-dom v7)         |
| Build     | Vite                                        |
| Styling   | Tailwind CSS v4 (Vite plugin — no PostCSS)  |
| Icons     | lucide-react                                |
| Backend   | Supabase (Auth, Database, Storage)          |

---

## Folder Structure

```
src/
├── main.jsx                # App entry — provider hierarchy
├── index.css               # Design system tokens + utility classes
│
├── context/
│   ├── AuthContext.jsx      # Auth session + profile (useAuth)
│   └── CartContext.jsx      # Cart state + actions (useCart)
│
├── routes/
│   ├── AppRoutes.jsx        # createBrowserRouter definitions
│   ├── ProtectedRoute.jsx   # Auth guard (→ /login)
│   └── AdminRoute.jsx       # Admin guard (→ /login or /)
│
├── layouts/
│   └── MainLayout.jsx       # Navbar + <Outlet> + Footer shell
│
├── components/
│   ├── Navbar.jsx           # Sticky nav, mobile drawer, cart badge
│   ├── Footer.jsx           # Brand links, social icons
│   ├── Button.jsx           # primary | outline | ghost variants
│   ├── ProductCard.jsx      # Card with image, price, actions
│   ├── ProductGrid.jsx      # Responsive grid of ProductCards
│   ├── Toast.jsx            # Auto-dismissing notification
│   ├── HeroCarousel.jsx     # Image carousel with dots
│   └── AdminSettingsCard.jsx # Max items per order setting card
│
├── pages/
│   ├── Home.jsx             # Landing page (hero, pillars, featured)
│   ├── Shop.jsx             # Product grid with search/filter
│   ├── ProductDetail.jsx    # PDP with variants, gallery, reviews
│   ├── Cart.jsx             # Cart management + checkout CTA
│   ├── Checkout.jsx         # Address form + COD order placement
│   ├── Login.jsx            # Email/password + Google OAuth
│   ├── MyOrders.jsx         # Order history + review submission
│   ├── AdminDashboard.jsx   # Admin shell (tab bar + stats)
│   ├── ErrorPage.jsx        # Router error boundary
│   ├── NotFound.jsx         # 404 page
│   └── admin/
│       ├── AdminProducts.jsx   # CRUD products, images, variants
│       ├── AdminOrders.jsx     # Order list, status, CSV export
│       ├── AdminHomepage.jsx   # Homepage CMS editor
│       ├── AdminReviews.jsx    # Review moderation
│       └── AdminSettings.jsx   # App-wide settings
│
├── services/
│   ├── products.js             # Product fetch + DB→frontend mapping
│   ├── supabase/client.js      # Supabase singleton (with env validation)
│   └── api/settings.js         # Max items per order CRUD
│
└── data/
    ├── products.seed.json      # Seed data for dev
    └── products.seed_backup.json
```

---

## Architecture

```
┌─────── Browser ───────┐
│                        │
│  AuthProvider          │   ← session + profile from Supabase Auth
│   └─ CartProvider      │   ← cart state in localStorage + maxItems from DB
│       └─ RouterProvider│   ← createBrowserRouter (react-router v7)
│           └─ MainLayout│   ← Navbar + Outlet + Footer
│               └─ Pages │
│                        │
└────────────────────────┘
         ↕ Supabase JS Client
┌────── Supabase ───────┐
│  Auth · Database · Storage │
└────────────────────────┘
```

### Context Providers

- **AuthProvider** — wraps the entire app. Uses `supabase.auth.onAuthStateChange()` to track session, fetches the `profiles` row (with retry), exposes `isAdmin`.
- **CartProvider** — manages cart items in `localStorage`, enforces `max_items_per_order` from the `app_settings` table, exposes `lastAction` for toast notifications.

### Route Guards

- **ProtectedRoute** — requires `isAuthenticated` → redirects to `/login`
- **AdminRoute** — requires both `isAuthenticated` and `isAdmin`

---

## Scripts

| Command          | Description                  |
|------------------|------------------------------|
| `npm run dev`    | Start Vite dev server        |
| `npm run build`  | Production build to `dist/`  |
| `npm run preview`| Preview production build     |
| `npm run lint`   | Run ESLint                   |

---

## Contributing

Every source file has a JSDoc header explaining its purpose and key exports.  
Open any `.jsx` file and read the top comment block for a quick orientation.

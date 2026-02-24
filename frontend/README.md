# Core Atoms — Frontend

E-commerce storefront for **Core Atoms** (premium nutraceuticals).  
Built with **React 19 + Vite 7 + Tailwind CSS v4 + Supabase**.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Variables](#environment-variables)
3. [Tech Stack](#tech-stack)
4. [NPM Scripts](#npm-scripts)
5. [Folder Structure](#folder-structure)
6. [Architecture & Provider Hierarchy](#architecture--provider-hierarchy)
7. [Routing & Navigation](#routing--navigation)
8. [Context Providers (Global State)](#context-providers-global-state)
9. [Pages — Detailed Breakdown](#pages--detailed-breakdown)
10. [Components — Detailed Breakdown](#components--detailed-breakdown)
11. [Custom Hooks](#custom-hooks)
12. [Services Layer (API / Data Access)](#services-layer-api--data-access)
13. [Styling & Design System](#styling--design-system)
14. [SEO](#seo)
15. [Performance Optimizations](#performance-optimizations)
16. [Error Handling Strategy](#error-handling-strategy)
17. [Security Considerations](#security-considerations)
18. [Supabase — Database Tables & RPC Functions](#supabase--database-tables--rpc-functions)
19. [Build Output & Code Splitting](#build-output--code-splitting)
20. [Common Development Tasks](#common-development-tasks)
21. [Troubleshooting](#troubleshooting)
22. [Contributing](#contributing)

---

## Quick Start

```bash
# 1 — Clone and navigate to the frontend directory
cd coreAtoms/frontend

# 2 — Install dependencies
npm install

# 3 — Create environment file with your Supabase credentials
cp .env.local.example .env.local
# Then edit .env.local and fill in your Supabase URL and anon key

# 4 — Start the development server (http://localhost:5173)
npm run dev
```

> **Prerequisite:** Node.js v18+ and npm v9+.

---

## Environment Variables

Create a `.env.local` file in the project root with the following:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

| Variable                  | Required | Description                                                  |
|--------------------------|----------|--------------------------------------------------------------|
| `VITE_SUPABASE_URL`      | ✅       | Your Supabase project URL (from Project Settings → API)     |
| `VITE_SUPABASE_ANON_KEY` | ✅       | Supabase publishable anon key (safe for client-side use)    |

> The app validates these on startup and throws a clear error if either is missing — see `src/services/supabase/client.js`.

---

## Tech Stack

| Layer       | Technology                           | Version | Purpose                          |
|------------|--------------------------------------|---------|----------------------------------|
| Framework  | React                                | 19.2    | UI library                       |
| Routing    | react-router-dom                     | 7.13    | Client-side routing (SPA)        |
| Build      | Vite                                 | 7.3     | Dev server + production bundler  |
| Styling    | Tailwind CSS                         | 4.1     | Utility-first CSS (via Vite plugin) |
| Icons      | lucide-react                         | 0.574   | Consistent icon set              |
| Backend    | @supabase/supabase-js               | 2.96    | Auth, database, storage, RPC     |
| SEO        | react-helmet-async                   | 2.0     | Dynamic `<head>` meta tags       |
| Linting    | ESLint + eslint-plugin-react-hooks   | 9.39    | Code quality                     |

> **Note:** Tailwind v4 uses the `@tailwindcss/vite` plugin directly — there is no `tailwind.config.js` file. All customization is done in `src/index.css` via `@theme` blocks and custom properties.

---

## NPM Scripts

| Command            | Description                                |
|-------------------|--------------------------------------------|
| `npm run dev`     | Start Vite dev server at `localhost:5173`   |
| `npm run build`   | Production build → outputs to `dist/`      |
| `npm run preview` | Serve the production `dist/` locally       |
| `npm run lint`    | Run ESLint across all source files         |

---

## Folder Structure

```
frontend/
├── index.html                  # HTML entry point
├── vite.config.js              # Vite config (React + Tailwind plugins)
├── package.json                # Dependencies and scripts
├── .env.local                  # ← YOUR Supabase credentials (git-ignored)
│
└── src/
    ├── main.jsx                # App entry — mounts React with all providers
    ├── index.css               # Design system: colors, fonts, utilities, animations
    │
    ├── context/                # React Context providers (global state)
    │   ├── AuthContext.jsx     # Authentication + user profiles
    │   ├── CartContext.jsx     # Shopping cart state + localStorage persistence
    │   └── ToastContext.jsx    # Global toast notification system
    │
    ├── routes/                 # Routing configuration
    │   ├── AppRoutes.jsx       # All route definitions (createBrowserRouter)
    │   ├── ProtectedRoute.jsx  # Auth guard → /login with redirect preservation
    │   └── AdminRoute.jsx      # Admin guard → requires isAdmin role
    │
    ├── layouts/                # Page layouts
    │   └── MainLayout.jsx      # Navbar + <Suspense> + <ErrorBoundary> + <Outlet> + Footer
    │
    ├── components/             # Reusable UI components
    │   ├── Navbar.jsx          # Sticky nav bar, mobile hamburger drawer, cart badge
    │   ├── Footer.jsx          # Site footer with brand links and social icons
    │   ├── Button.jsx          # Button variants: primary | outline | ghost
    │   ├── ProductCard.jsx     # Standalone product card (used in ProductGrid)
    │   ├── ProductGrid.jsx     # Responsive grid wrapper for ProductCards
    │   ├── SEO.jsx             # <Helmet> wrapper for title, meta, OG tags
    │   ├── Skeleton.jsx        # Loading skeleton components (grid, card, order, detail)
    │   ├── Toast.jsx           # Individual toast notification component
    │   ├── HeroCarousel.jsx    # Image carousel with dots + swipe
    │   ├── ErrorBoundary.jsx   # React error boundary with fallback UI
    │   ├── AdminSettingsCard.jsx # Admin: max items per order setting
    │   └── ImagePositionAdjuster.jsx # Admin: drag-to-position image focal point
    │
    ├── pages/                  # Route-level page components
    │   ├── Home.jsx            # Landing page (hero carousel, pillars, featured products)
    │   ├── Shop.jsx            # Product listing with search + category filter
    │   ├── ProductDetail.jsx   # Single product page (variants, gallery, reviews)
    │   ├── Cart.jsx            # Cart management + order summary
    │   ├── Checkout.jsx        # Address form + COD order placement
    │   ├── Login.jsx           # Email/password + Google OAuth authentication
    │   ├── MyOrders.jsx        # Order history, cancellation, review submission
    │   ├── AdminDashboard.jsx  # Admin shell with tab navigation + stats
    │   ├── ErrorPage.jsx       # Router-level error fallback
    │   ├── NotFound.jsx        # 404 page
    │   └── admin/              # Admin sub-pages
    │       ├── AdminProducts.jsx    # Full CRUD: products, images, variants
    │       ├── AdminOrders.jsx      # Order list, status updates, CSV export
    │       ├── AdminHomepage.jsx    # Homepage CMS: hero, pillars, categories
    │       ├── AdminReviews.jsx     # Review moderation
    │       └── AdminSettings.jsx    # App-wide settings
    │
    ├── services/               # Data access layer (all Supabase calls)
    │   ├── supabase/
    │   │   └── client.js       # Supabase client singleton (validates env vars)
    │   ├── products.js         # Product queries + DB→frontend data mapping
    │   ├── addresses.js        # User address CRUD (with RLS guards)
    │   ├── orders.js           # Order queries, cancellation, review submission
    │   ├── homepage.js         # Homepage settings fetch
    │   ├── errorReporter.js    # Environment-aware error reporting utility
    │   └── api/
    │       └── settings.js     # Admin settings CRUD (max items per order)
    │
    ├── hooks/                  # Custom React hooks
    │   ├── useDebounce.js      # Debounce any value (used in search)
    │   ├── useDocumentTitle.js # Set document title (legacy, replaced by SEO)
    │   └── useFormValidation.js # Form validation with errors + touched state
    │
    └── data/                   # Static / seed data
        ├── products.seed.json       # Sample product data for development
        └── products.seed_backup.json
```

---

## Architecture & Provider Hierarchy

The app is structured as a single-page application with nested React context providers:

```
<React.StrictMode>
  <HelmetProvider>              ← SEO: allows <Helmet> in any component
    <AuthProvider>              ← Session, user profile, isAdmin, signOut
      <CartProvider>            ← Cart items in localStorage, max order limit
        <ToastProvider>         ← Global toast notifications
          <RouterProvider>      ← Client-side routing (react-router v7)
            <MainLayout>        ← Navbar + Suspense + ErrorBoundary + Outlet + Footer
              <Page />          ← Matched route component
            </MainLayout>
          </RouterProvider>
        </ToastProvider>
      </CartProvider>
    </AuthProvider>
  </HelmetProvider>
</React.StrictMode>
```

**Why this order matters:**
- `AuthProvider` wraps `CartProvider` so the cart can access the user's session
- `CartProvider` wraps the router so any page can access cart actions
- `ToastProvider` wraps the router so any page can show toast notifications
- `HelmetProvider` wraps everything so SEO tags work from any component

---

## Routing & Navigation

All routes are defined in `src/routes/AppRoutes.jsx` using `createBrowserRouter` (React Router v7).

### Public Routes (no login required)

| Path              | Component          | Description                     |
|-------------------|--------------------|---------------------------------|
| `/`               | `Home`             | Landing page                    |
| `/shop`           | `Shop` (lazy)      | Product listing with filters    |
| `/product/:id`    | `ProductDetail` (lazy) | Single product page         |
| `/cart`           | `Cart` (lazy)      | Shopping cart                   |
| `/login`          | `Login`            | Sign in / sign up               |

### Protected Routes (login required)

| Path              | Component          | Guard             | Description           |
|-------------------|--------------------|--------------------|----------------------|
| `/checkout`       | `Checkout` (lazy)  | `ProtectedRoute`   | Place an order        |
| `/orders`         | `MyOrders` (lazy)  | `ProtectedRoute`   | View order history    |

### Admin Routes (admin role required)

| Path              | Component            | Guard         | Description            |
|-------------------|----------------------|---------------|------------------------|
| `/admin`          | `AdminDashboard` (lazy) | `AdminRoute` | Admin CMS dashboard   |

### Route Guards

- **`ProtectedRoute`** — Checks `isAuthenticated`. If false, redirects to `/login?redirect=/original-path` so the user returns to their intended page after signing in
- **`AdminRoute`** — Checks both `isAuthenticated` and `isAdmin`. Non-admins are redirected away

### Lazy Loading

The following pages are lazy-loaded using `React.lazy()` for code splitting:
- `Shop`, `Cart`, `ProductDetail`, `Checkout`, `MyOrders`, `AdminDashboard`

The following pages are eagerly loaded (critical path):
- `Home`, `Login`, `NotFound`, `ErrorPage`

---

## Context Providers (Global State)

### 1. AuthContext (`src/context/AuthContext.jsx`)

Manages Supabase authentication, user sessions, and profiles.

**What it provides (via `useAuth()`):**

| Property          | Type       | Description                                    |
|-------------------|------------|------------------------------------------------|
| `loading`         | `boolean`  | `true` while the auth state is being resolved  |
| `session`         | `object`   | Raw Supabase session object (or `null`)        |
| `user`            | `object`   | Supabase user object (or `null`)               |
| `profile`         | `object`   | Row from `profiles` table (name, role, etc.)   |
| `isAuthenticated` | `boolean`  | `true` if there's an active session            |
| `isAdmin`         | `boolean`  | `true` if `profile.role === "admin"`           |
| `signOut()`       | `function` | Signs out, clears profile + activity timestamp |

**Key behaviors:**
- Listens to `supabase.auth.onAuthStateChange()` for real-time session changes
- Fetches the `profiles` row on sign-in with retry logic (waits for Supabase trigger to create the profile)
- **Inactivity timeout:** Signs the user out after 1 hour of inactivity. Tracks the last activity timestamp in `localStorage` under `last_activity_timestamp`

### 2. CartContext (`src/context/CartContext.jsx`)

Manages the shopping cart with localStorage persistence and order limits.

**What it provides (via `useCart()`):**

| Property          | Type       | Description                                           |
|-------------------|------------|-------------------------------------------------------|
| `items`           | `array`    | Cart items `[{ id, name, image, category, unitPrice, qty }]` |
| `addItem(product, qty)` | `function` | Add product to cart (enforces max items limit)  |
| `updateQty(id, qty)`    | `function` | Update item quantity (0 removes it)            |
| `removeItem(id)`        | `function` | Remove item by ID                              |
| `clear()`               | `function` | Empty the entire cart                          |
| `totalItems`      | `number`   | Sum of all item quantities                            |
| `subtotal`        | `number`   | Sum of `unitPrice × qty` for all items                |
| `maxItems`        | `number`   | Max items per order (from `app_settings` table)       |
| `lastAction`      | `object`   | Last cart action (for toast feedback: `{ type, name, qty }`) |
| `refreshMaxItems()` | `function` | Re-fetch max items (called after admin saves settings) |

**Key behaviors:**
- Cart is stored in `localStorage` under the key `cart_items`
- Items are normalized on every read to ensure consistent shape
- Enforces `max_items_per_order` limit — trying to exceed shows a warning toast
- All functions are wrapped in `useCallback` for stable references

### 3. ToastContext (`src/context/ToastContext.jsx`)

Global toast notification system with variants and auto-dismiss.

**What it provides (via `useToast()`):**

| Method                                      | Description                      |
|---------------------------------------------|----------------------------------|
| `showToast(message, variant?, duration?)`   | Show a toast notification        |

**Variants:** `"success"` (green), `"error"` (red), `"info"` (blue), `"warning"` (amber)

**Default duration:** 3000ms. Toasts auto-dismiss and support manual close.

---

## Pages — Detailed Breakdown

### Home (`src/pages/Home.jsx`)
- **Sections:** Hero carousel → Brand pillars → Featured products → Category browser → Philosophy statement
- **Data source:** All content is CMS-driven from the `app_settings` table. Falls back to hardcoded defaults if admin hasn't configured anything
- **Error handling:** If product fetch fails, shows an error card with a "Try again" button
- **Hero carousel:** Auto-advances every 5 seconds. Images are loaded from Supabase storage via admin-managed URLs

### Shop (`src/pages/Shop.jsx`)
- **Features:** Full product grid with live search (debounced 300ms), category dropdown filter, URL-synced filters (`?q=...&category=...`)
- **Sub-exports:** This file also exports `ProductCard` (wrapped in `React.memo`) and `Stars` rating display — both used by `Home.jsx`
- **Add to cart:** Inline feedback: button turns green with "Added to cart ✓" for 1 second, plus a floating toast notification
- **Variant products:** Shows variant chips on the card and a "Select option →" button that links to the detail page

### ProductDetail (`src/pages/ProductDetail.jsx`)
- **Features:** Image gallery with thumbnails, variant picker (size/flavor), quantity stepper, stock status, highlight pills, "About" section, customer reviews
- **Variant handling:** Uses composite cart keys (`productId_variantId`) so different variants are tracked separately in the cart
- **Limits:** Shows warnings for out-of-stock and max-items-per-order exceeded

### Cart (`src/pages/Cart.jsx`)
- **Features:** Item list with quantity steppers, line totals, order summary sidebar, "Proceed to checkout" CTA
- **Auth check:** If user is not logged in, clicking "Proceed to checkout" navigates to `/login` instead of `/checkout`
- **Currency:** All amounts formatted as `₹X,XXX` (Indian Rupees)

### Checkout (`src/pages/Checkout.jsx`)
- **Address management:** Loads saved addresses from Supabase, allows selecting or adding a new one. New addresses can be saved for future use
- **Address deletion:** Inline confirmation UI (no browser `confirm()` dialog). Includes `.eq("user_id")` RLS guard
- **Validation:** Indian phone (10 digits starting with 6-9) + 6-digit pincode + required fields
- **Order placement:** Calls the `place_order_cod` Supabase RPC function. On success, shows an animated "Order placed!" screen and redirects to `/orders`
- **Error handling:** Uses toast notifications for all errors (stock issues, validation failures)

### Login (`src/pages/Login.jsx`)
- **Auth methods:** Email/password (sign up and sign in) + Google OAuth
- **Redirect:** After login, checks for `?redirect=` query param (set by `ProtectedRoute`) and navigates there. Otherwise checks if user is admin → `/admin`, else → `/`
- **UI feedback:** Shows success/error messages inline below the form

### MyOrders (`src/pages/MyOrders.jsx`)
- **Features:** Order list with search/filter by status, order item details with images, review submission per product
- **Cancellation:** Inline "Cancel" button with confirmation step (Confirm cancel / Keep). Cannot cancel after shipment
- **Reviews:** Star rating (1-5) + optional text. Prevents duplicate reviews using a tracked `reviewedKeys` set

### Admin Pages (`src/pages/admin/`)
- **AdminProducts.jsx** — Full CRUD for products: name, description, price, stock, category, images (drag to reposition), variants (label, price, stock, SKU), highlights
- **AdminOrders.jsx** — View all orders, update status (pending → confirmed → shipped → delivered), CSV export
- **AdminHomepage.jsx** — CMS editor for the homepage: hero images, hero copy text, featured product picker, pillars, categories, philosophy section
- **AdminReviews.jsx** — Review moderation dashboard
- **AdminSettings.jsx** — App-wide settings like max items per order

---

## Components — Detailed Breakdown

| Component                  | File                       | Description |
|---------------------------|----------------------------|-------------|
| **Navbar**                | `Navbar.jsx`               | Sticky top nav. Desktop: horizontal links + cart badge. Mobile: hamburger menu with slide-out drawer. Shows inline toast when items are added to cart |
| **Footer**                | `Footer.jsx`               | Brand info, navigation links, social media icons |
| **Button**                | `Button.jsx`               | Three variants: `primary` (solid blue), `outline` (bordered), `ghost` (text only). Accepts `onClick`, `disabled`, `type`, `className` overrides |
| **ProductCard**           | `ProductCard.jsx`          | Standalone card: image, name, price, stock badge, "Add to cart" button. Used by `ProductGrid` |
| **ProductCard (Shop)**    | `Shop.jsx` (exported)      | Enhanced card with variant chips, rating stars, description truncation. Wrapped in `React.memo`. Used by both `Shop` and `Home` |
| **ProductGrid**           | `ProductGrid.jsx`          | Simple responsive grid wrapper — renders children in a CSS grid |
| **SEO**                   | `SEO.jsx`                  | Reusable `<Helmet>` wrapper. Props: `title`, `description`, `ogImage`, `noIndex`. Sets `<title>`, meta description, Open Graph, and Twitter Card tags |
| **Skeleton**              | `Skeleton.jsx`             | Export multiple skeleton variants: `SkeletonGrid`, `SkeletonProductDetail`, `SkeletonOrderCard`. Used as loading placeholders |
| **Toast**                 | `Toast.jsx`                | Individual toast notification with enter/exit animations |
| **HeroCarousel**          | `HeroCarousel.jsx`         | Image carousel with indicator dots and auto-advance |
| **ErrorBoundary**         | `ErrorBoundary.jsx`        | React class component error boundary. Catches render errors, displays fallback UI with "Try again" button, reports errors via `errorReporter` |
| **AdminSettingsCard**     | `AdminSettingsCard.jsx`    | Admin-only card for editing the "max items per order" setting |
| **ImagePositionAdjuster** | `ImagePositionAdjuster.jsx`| Admin-only: drag an image to set the CSS `object-position` focal point |

---

## Custom Hooks

### `useDebounce(value, delay = 300)` — `src/hooks/useDebounce.js`

Returns a debounced version of the input value that only updates after `delay`ms of no changes. Used by the Shop search bar to avoid firing a query on every keystroke.

```jsx
const debouncedQuery = useDebounce(searchText, 300);
// debouncedQuery only updates 300ms after the user stops typing
```

### `useDocumentTitle(title)` — `src/hooks/useDocumentTitle.js`

Sets `document.title` and restores the previous title on unmount. **Legacy** — most pages now use the `<SEO>` component instead for richer meta tags.

### `useFormValidation(values, rules)` — `src/hooks/useFormValidation.js`

Lightweight form validation hook. Tracks touched state and computes errors.

```jsx
const { errors, touched, validate, touchField, isValid } = useFormValidation(
  { name, phone },
  {
    name: (v) => (!v.trim() ? "Name is required" : ""),
    phone: (v) => (!/^\d{10}$/.test(v) ? "10-digit phone required" : ""),
  }
);
```

**Returns:**
- `errors` — `{ fieldName: "error message" }` for fields with issues
- `touched` — `{ fieldName: true }` for fields the user has interacted with
- `validate()` — Touches all fields and returns `true` if form is valid
- `touchField(name)` — Mark a single field as touched
- `isValid` — `true` if there are zero errors

---

## Services Layer (API / Data Access)

All Supabase database calls are centralized in service modules under `src/services/`. This keeps page components thin and makes logic testable.

### `supabase/client.js`
- Creates the Supabase client singleton
- Validates `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` on import — throws if missing

### `products.js`
- `fetchProducts()` — Fetches all active products with variants and reviews, sorted alphabetically
- `fetchProductById(id)` — Fetches a single product with full details
- `mapDbProduct(row)` — Maps a Supabase DB row into the frontend product shape (camelCase, computed fields like `avgRating`, `reviewCount`)

### `addresses.js`
- `fetchUserAddresses(userId)` — Gets all saved addresses for a user
- `createAddress(userId, address)` — Inserts a new address
- `deleteAddress(addressId, userId)` — Deletes an address with `user_id` guard

### `orders.js`
- `fetchUserOrders(userId)` — Gets all orders with their line items
- `fetchUserReviewKeys(userId)` — Returns a `Set<string>` of `"productId_orderId"` keys for existing reviews
- `cancelOrder(orderId, userId)` — Cancels via the `cancel_order` RPC
- `submitReview({ productId, userId, orderId, rating, body })` — Inserts a product review

### `homepage.js`
- `fetchHomepageSettings()` — Fetches all homepage CMS settings from `app_settings`

### `api/settings.js`
- `getMaxItemsPerOrder()` — Reads the max items per order from `app_settings`
- `setMaxItemsPerOrder(value)` — Updates or inserts the max items per order setting

### `errorReporter.js`
- `reportError(error, context)` — Enhanced `console.error` with context metadata in development. In production, ready to be extended to POST to Sentry, LogRocket, or any external service
- `reportWarning(message, context)` — Same for non-fatal warnings

---

## Styling & Design System

### Design Tokens (defined in `src/index.css`)

The project uses Tailwind CSS v4 with a `@theme` block for custom design tokens:

**Color palette:**
- Primary: `#1e3a5f` (deep navy blue) — used for buttons, links, selected states
- Accent hover: `#162d4a` (darker navy) — button hover states
- Borders: `#E8E4DE` (warm stone) — card borders, dividers
- Background: `#FAFAF8` (off-white) — page background
- Text: stone-900 (headings), stone-500 (body), stone-400 (muted)

**Custom CSS classes (defined in `index.css`):**
- `.card` — Rounded card with border, shadow, and padding
- `.btn-primary` — Solid navy button with hover effects and subtle transform
- `.btn-ghost` — Outlined button with hover fill
- `.section-label` — Uppercase tracking-wide label (styled as "OUR COLLECTION", "REVIEW & CHECKOUT", etc.)

**Animations (defined as `@keyframes` in `index.css`):**
- `toastIn` — Slide-in for toast notifications
- `animate-toast-in` — Utility class for toast animation
- `coreatoms_progress` — Loading bar animation (checkout success screen)

### Responsive Breakpoints

Standard Tailwind breakpoints are used:
- `sm:` ≥ 640px
- `lg:` ≥ 1024px

Layout max-width: `max-w-6xl` (72rem / 1152px)

---

## SEO

The `<SEO>` component (`src/components/SEO.jsx`) uses `react-helmet-async` to inject dynamic `<head>` tags.

**Usage in any page:**
```jsx
<SEO
  title="Shop | Core Atoms"
  description="Browse our full range of premium nutraceuticals."
  ogImage="/path/to/image.jpg"  // Optional
  noIndex={false}               // Set true for Checkout, admin pages
/>
```

**What it sets:**
- `<title>` — Appends `| Core Atoms` if not already present
- `<meta name="description">` — Page-specific description
- `<meta property="og:title/description/image/site_name/type">` — Open Graph (Facebook, LinkedIn)
- `<meta name="twitter:card/title/description/image">` — Twitter Card
- `<meta name="robots" content="noindex,nofollow">` — Optional, for private pages

**Pages with SEO configured:**
| Page | Title | noIndex |
|------|-------|---------|
| Home | Core Atoms \| Premium Nutraceuticals | No |
| Shop | Shop \| Core Atoms | No |
| Product Detail | {Product Name} \| Core Atoms | No |
| Cart | Cart \| Core Atoms | No |
| Login | Login \| Core Atoms | No |
| My Orders | My Orders \| Core Atoms | No |
| Checkout | Checkout \| Core Atoms | Yes |

---

## Performance Optimizations

1. **Route-level code splitting** — 6 pages are lazy-loaded with `React.lazy()`. Each becomes a separate JS chunk in the production build
2. **`React.memo`** on `ProductCard` (Shop.jsx) — prevents re-renders when sibling cards change (e.g. one card shows "Added to cart")
3. **`useCallback`** on all CartContext functions — ensures stable function references, reducing unnecessary re-renders
4. **Image `loading="lazy"`** — All product images, thumbnails, and non-first hero carousel slides use native lazy loading
5. **Image `sizes` attribute** — Responsive hints so the browser loads appropriately sized images:
   - Product cards: `(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw`
   - Hero/detail images: `(max-width: 1024px) 100vw, 50vw`
6. **Debounced search** — Shop search bar uses `useDebounce(300ms)` to avoid firing on every keystroke
7. **Global `<Suspense>`** boundary in `MainLayout` with a spinner fallback for lazy routes

---

## Error Handling Strategy

| Layer              | Mechanism                          | Behavior                           |
|-------------------|------------------------------------|------------------------------------|
| **Render errors**  | `<ErrorBoundary>` in `MainLayout` | Catches crashes, shows fallback UI with "Try again" button. Reports via `errorReporter` |
| **Route errors**   | `errorElement` in router          | Shows `ErrorPage` for routing failures |
| **API errors**     | Try/catch in service calls        | Shows toast notifications via `useToast()` |
| **Network errors** | Error state + retry button        | `Home.jsx` shows "Unable to load products" card with retry. `Shop.jsx` shows inline error |
| **Form validation**| Inline messages                   | `Checkout.jsx` shows per-field validation + amber warning bar |
| **Production**     | `errorReporter.js`                | Structured logging, ready for Sentry integration |

**No `alert()` or `confirm()` is used anywhere.** All user-facing messages use the toast system or inline confirmation patterns.

---

## Security Considerations

1. **Row Level Security (RLS):** All Supabase mutations include `.eq("user_id", user.id)` as a defense-in-depth measure. Even if RLS policies are misconfigured on the Supabase side, the client-side queries will only affect the authenticated user's data
2. **Environment variables:** Supabase credentials are stored in `.env.local` (git-ignored). Only the publishable `anon` key is used client-side — never the `service_role` key
3. **Session timeout:** Users are automatically signed out after 1 hour of inactivity (tracked via `localStorage`)
4. **Protected routes:** Server-side RPC functions (`place_order_cod`, `cancel_order`) accept `p_user_id` parameters and should validate ownership on the database side

---

## Supabase — Database Tables & RPC Functions

The frontend interacts with these Supabase resources:

### Tables

| Table              | Used By                      | Operations          |
|-------------------|------------------------------|-----------------------|
| `products`         | Shop, Home, ProductDetail   | SELECT (with joins)   |
| `product_variants` | ProductDetail, Admin        | SELECT, INSERT, UPDATE, DELETE |
| `product_reviews`  | ProductDetail, MyOrders     | SELECT, INSERT        |
| `orders`           | MyOrders, Checkout          | SELECT                |
| `order_items`      | MyOrders                    | SELECT (via join)     |
| `addresses`        | Checkout                    | SELECT, INSERT, DELETE |
| `profiles`         | AuthContext, Login           | SELECT                |
| `app_settings`     | Home, CartContext, Admin    | SELECT, UPSERT        |

### RPC Functions

| Function            | Called From     | Parameters                        | Purpose                    |
|---------------------|-----------------|-----------------------------------|----------------------------|
| `place_order_cod`   | Checkout.jsx    | `p_user_id`, `p_address`, `p_items` | Places a COD order, deducts stock |
| `cancel_order`      | MyOrders.jsx    | `p_order_id`, `p_user_id`         | Cancels an order, restores stock  |

### Storage Buckets

| Bucket             | Used For                     |
|-------------------|------------------------------|
| Product images     | Product cards, details, admin upload |
| Logo/branding      | Navbar logo (fetched from `app_settings`) |

---

## Build Output & Code Splitting

Running `npm run build` produces:

```
dist/
├── index.html
└── assets/
    ├── index-*.css          (~65 KB)     ← All styles
    ├── index-*.js           (~526 KB)    ← Main bundle (React, router, contexts, Home, Shop, Login)
    ├── Cart-*.js            (~5 KB)      ← Lazy chunk
    ├── MyOrders-*.js        (~10 KB)     ← Lazy chunk
    ├── Checkout-*.js        (~11 KB)     ← Lazy chunk
    ├── ProductDetail-*.js   (~13 KB)     ← Lazy chunk
    └── AdminDashboard-*.js  (~97 KB)     ← Lazy chunk (admin-only code)
```

> **Note:** `Shop.jsx` is not a separate chunk because `Home.jsx` statically imports `ProductCard` from it. This is intentional — `ProductCard` is needed on the landing page.

---

## Common Development Tasks

### Adding a new page

1. Create `src/pages/YourPage.jsx`
2. Add a `<SEO>` component at the top of the JSX return
3. Add the route in `src/routes/AppRoutes.jsx`:
   - For lazy loading: `const YourPage = React.lazy(() => import("../pages/YourPage"))`
   - Add route in the `children` array of `MainLayout`
4. If the page requires authentication, wrap with `<ProtectedRoute>`

### Adding a new Supabase query

1. Create or update the relevant service file in `src/services/`
2. Import `supabase` from `./supabase/client`
3. Always include `.eq("user_id", userId)` on mutations for RLS safety
4. Handle errors with try/catch and use `showToast()` for user feedback

### Adding a new component

1. Create `src/components/YourComponent.jsx`
2. Add a JSDoc header comment explaining the component's purpose
3. Use the design tokens from `index.css` (colors, borders, shadows)
4. If the component receives frequent prop changes, consider wrapping with `React.memo`

### Modifying the design system

1. Open `src/index.css`
2. Custom properties and utility classes are defined at the top
3. Tailwind v4 theme overrides go inside `@theme { }` blocks
4. Custom animations use standard `@keyframes` blocks

### Adding Supabase RPC functions

1. Create the function in the Supabase SQL editor
2. Call it from a service file: `supabase.rpc("function_name", { params })`
3. Handle the response in the calling component with error toasts

---

## Troubleshooting

| Issue                                    | Cause                                   | Solution                                      |
|-----------------------------------------|-----------------------------------------|-----------------------------------------------|
| App crashes on start with "Supabase URL missing" | `.env.local` not set up              | Copy `.env.local.example` → `.env.local` and fill in credentials |
| `npm install` fails with peer dependency conflict | React 19 vs older packages          | Use `npm install --legacy-peer-deps`          |
| Cart items disappear on login           | `localStorage` key mismatch            | Cart uses `cart_items` key — ensure no conflicting code clears it |
| Admin pages 404                         | User doesn't have admin role           | Set `role: "admin"` in Supabase `profiles` table |
| Forms don't submit                      | Validation not passing                 | Check browser console + ensure all required fields follow the Indian phone/pincode format |
| Images don't load                       | Supabase storage URLs expired/incorrect | Check image URLs in the admin dashboard     |
| Build warning about large chunks        | Main bundle > 500KB                    | Expected — includes React + router + Tailwind runtime |

---

## Contributing

1. **Every source file has a JSDoc header** — open any `.jsx` file and read the top comment block for a quick orientation on what it does
2. **Follow the services pattern** — keep Supabase calls in `src/services/`, not inline in components
3. **Use `showToast()` for user feedback** — never use `alert()`, `confirm()`, or `prompt()`
4. **Wrap with `React.memo`** — if a component renders in a list and receives stable props
5. **Add `<SEO>` to new pages** — every page should have a unique title and description
6. **Run `npm run build` before pushing** — ensure no build errors are introduced
7. **Use `--legacy-peer-deps`** if `npm install` fails — required due to React 19 compatibility

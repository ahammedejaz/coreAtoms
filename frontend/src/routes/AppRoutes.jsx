/**
 * AppRoutes.jsx — Application route definitions.
 *
 * Uses `createBrowserRouter` (react-router v7 data router). All routes live
 * inside a `MainLayout` shell that renders `<Navbar>` + `<Outlet>` + `<Footer>`.
 *
 * ### Route Map:
 * | Path            | Component       | Guard          |
 * |-----------------|-----------------|----------------|
 * | `/`             | `HomeRoute`     | admin redirect  |
 * | `/shop`         | `Shop`          | public          |
 * | `/cart`         | `Cart`          | public          |
 * | `/product/:id`  | `ProductDetail` | public          |
 * | `/login`        | `Login`         | public          |
 * | `/orders`       | `MyOrders`      | `ProtectedRoute`|
 * | `/checkout`     | `Checkout`      | `ProtectedRoute`|
 * | `/admin`        | `AdminDashboard`| `AdminRoute`    |
 * | `*`             | `NotFound`      | —               |
 *
 * @module routes/AppRoutes
 */
import { createBrowserRouter, Navigate } from "react-router-dom";
import React, { Suspense } from "react";
import MainLayout from "../layouts/MainLayout";

import Home from "../pages/Home";
import Login from "../pages/Login";
import ForgotPassword from "../pages/ForgotPassword";
import NotFound from "../pages/NotFound";
import ErrorPage from "../pages/ErrorPage";

/** Set once we've already force-reloaded for a failed chunk, so we can't loop. */
const CHUNK_RELOAD_KEY = "coreatoms_chunk_reloaded";

/**
 * `React.lazy` memoises a *rejected* promise, so once a chunk fails to load —
 * the usual stale-hash failure right after a deploy — every retry re-throws the
 * same error and the ErrorBoundary's "Try again" button looks dead. Retry the
 * import once, then fall back to a single hard reload to pick up the new
 * asset manifest.
 */
function lazyWithRetry(importer) {
  return React.lazy(() =>
    importer()
      .then((mod) => {
        try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* ignore */ }
        return mod;
      })
      .catch(() => importer().catch((err) => {
        // Default to "already reloaded" so an unavailable sessionStorage means
        // the error surfaces instead of the page reloading in a loop.
        let alreadyReloaded = true;
        try {
          alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1";
          if (!alreadyReloaded) sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
        } catch { /* ignore */ }

        if (alreadyReloaded) throw err;
        window.location.reload();
        return new Promise(() => { }); // never settles — the reload takes over
      }))
  );
}

/** Lazy-loaded pages — keeps heavy code out of the initial bundle. */
const Shop = lazyWithRetry(() => import("../pages/Shop"));
const Cart = lazyWithRetry(() => import("../pages/Cart"));
const ProductDetail = lazyWithRetry(() => import("../pages/ProductDetail"));
const MyOrders = lazyWithRetry(() => import("../pages/MyOrders"));
const Checkout = lazyWithRetry(() => import("../pages/Checkout"));
const ResetPassword = lazyWithRetry(() => import("../pages/ResetPassword"));
const AdminDashboard = lazyWithRetry(() => import("../pages/AdminDashboard.jsx"));

// Policy and help pages — lazy so the legal chunk never weighs down the shop
const TermsAndConditions = lazyWithRetry(() => import("../pages/legal/TermsAndConditions"));
const PrivacyPolicy = lazyWithRetry(() => import("../pages/legal/PrivacyPolicy"));
const ShippingPolicy = lazyWithRetry(() => import("../pages/legal/ShippingPolicy"));
const RefundPolicy = lazyWithRetry(() => import("../pages/legal/RefundPolicy"));
const Contact = lazyWithRetry(() => import("../pages/legal/Contact"));
const FAQPage = lazyWithRetry(() => import("../pages/legal/FAQPage"));

import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./AdminRoute";
import RouteFallback from "./RouteFallback";
import { useAuth } from "../context/AuthContext";

// Redirects admins away from the public home page to /admin
function HomeRoute() {
  const { loading, isAdmin, isAuthenticated, roleResolved } = useAuth();
  // Wait for the authoritative role before deciding — but never render nothing:
  // if the profile fetch ultimately fails, `roleResolved` still flips and the
  // storefront renders instead of a permanently blank page.
  if (loading || (isAuthenticated && !roleResolved)) return <RouteFallback />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return <Home />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: "shop", element: <Shop /> },
      { path: "cart", element: <Cart /> },
      { path: "product/:id", element: <ProductDetail /> },
      { path: "login", element: <Login /> },
      { path: "forgot-password", element: <ForgotPassword /> },
      { path: "reset-password", element: <Suspense fallback={<RouteFallback />}><ResetPassword /></Suspense> },

      // Policies & help — public, static, indexable
      { path: "terms", element: <TermsAndConditions /> },
      { path: "privacy", element: <PrivacyPolicy /> },
      { path: "shipping-policy", element: <ShippingPolicy /> },
      { path: "refund-policy", element: <RefundPolicy /> },
      { path: "contact", element: <Contact /> },
      { path: "faq", element: <FAQPage /> },

      {
        path: "orders",
        element: (
          <ProtectedRoute>
            <MyOrders />
          </ProtectedRoute>
        ),
      },
      {
        path: "checkout",
        element: (
          <ProtectedRoute>
            <Checkout />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin",
        element: (
          <AdminRoute>
            <Suspense fallback={<RouteFallback label="Loading admin…" />}>
              <AdminDashboard />
            </Suspense>
          </AdminRoute>
        ),
      },

      // catch-all inside layout
      { path: "*", element: <NotFound /> },
    ],
  },
]);

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
import Shop from "../pages/Shop";
import Cart from "../pages/Cart";
import ProductDetail from "../pages/ProductDetail";
import Login from "../pages/Login";
import MyOrders from "../pages/MyOrders";
import Checkout from "../pages/Checkout";
import NotFound from "../pages/NotFound";
import ErrorPage from "../pages/ErrorPage";

/** Lazy-loaded admin — keeps admin code out of the main bundle for customers. */
const AdminDashboard = React.lazy(() => import("../pages/AdminDashboard.jsx"));

import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./AdminRoute";
import { useAuth } from "../context/AuthContext";

// Redirects admins away from the public home page to /admin
function HomeRoute() {
  const { loading, isAdmin } = useAuth();
  if (loading) return null; // wait silently — no flash
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
            <Suspense fallback={<div className="py-20 text-center text-sm text-stone-400 animate-pulse">Loading admin…</div>}>
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

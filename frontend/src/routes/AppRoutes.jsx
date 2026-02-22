import { createBrowserRouter, Navigate } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";

import Home from "../pages/Home";
import Shop from "../pages/Shop";
import Cart from "../pages/Cart";
import ProductDetail from "../pages/ProductDetail";
import Login from "../pages/Login";
import MyOrders from "../pages/MyOrders";
import Checkout from "../pages/Checkout";
import AdminDashboard from "../pages/AdminDashboard";
import NotFound from "../pages/NotFound";
import ErrorPage from "../pages/ErrorPage";

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
            <AdminDashboard />
          </AdminRoute>
        ),
      },

      // catch-all inside layout
      { path: "*", element: <NotFound /> },
    ],
  },
]);

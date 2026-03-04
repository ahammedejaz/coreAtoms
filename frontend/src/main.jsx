/**
 * main.jsx — Application entry point.
 *
 * Renders the React root with the following provider hierarchy:
 *   StrictMode → HelmetProvider → ToastProvider → AuthProvider → CartProvider → RouterProvider
 *
 * Toast wraps Auth so that AuthContext can show session-expiry toasts.
 * Auth wraps Cart so that cart operations can be aware of the user session.
 * The router is created in `AppRoutes.jsx` using `createBrowserRouter`.
 *
 * @module main
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { router } from "./routes/AppRoutes";
import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <RouterProvider router={router} />
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </HelmetProvider>
  </React.StrictMode>,
)

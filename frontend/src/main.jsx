/**
 * main.jsx — Application entry point.
 *
 * Renders the React root with the following provider hierarchy:
 *   StrictMode → ToastProvider → AuthProvider → CartProvider → CartDrawerProvider → RouterProvider
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
import { router } from "./routes/AppRoutes";
import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { CartDrawerProvider } from "./context/CartDrawerContext";
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/instrument-sans';
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <CartDrawerProvider>
            <RouterProvider router={router} />
          </CartDrawerProvider>
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>,
)

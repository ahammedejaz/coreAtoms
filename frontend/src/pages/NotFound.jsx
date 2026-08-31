/**
 * NotFound.jsx — 404 catch-all page.
 *
 * Displayed for any URL that doesn't match a defined route.
 * Provides links back to Home and Shop.
 *
 * @module pages/NotFound
 */
import { Link } from "react-router-dom";

import useDocumentTitle from "../hooks/useDocumentTitle";

export default function NotFound() {
  useDocumentTitle("Page Not Found | Core Atoms");
  return (
    <div className="min-h-[70vh] grid place-items-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-[#E8E4DE] bg-white p-8 shadow-sm text-center">
        <div className="text-sm text-stone-500">Core Atoms</div>
        <h1 className="mt-2 text-3xl font-semibold text-stone-900 tracking-tight">404</h1>
        <p className="mt-2 text-sm text-stone-600">
          The page you’re looking for doesn’t exist.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to="/"
            className="rounded-xl bg-[#1e3a5f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#16304f] transition"
          >
            Home
          </Link>
          <Link
            to="/shop"
            className="rounded-xl border border-[#E8E4DE] bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition"
          >
            Shop
          </Link>
        </div>
      </div>
    </div>
  );
}

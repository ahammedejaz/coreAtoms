/**
 * ErrorPage.jsx — React Router error boundary page.
 *
 * Shown when a route throws an error. Displays the error message and links
 * back to Home / Shop. The raw stack is developer-only — end users never see
 * internals of a production build.
 *
 * @module pages/ErrorPage
 */
import { Link, useRouteError } from "react-router-dom";

import useDocumentTitle from "../hooks/useDocumentTitle";

export default function ErrorPage() {
  useDocumentTitle("Error | Core Atoms");
  const err = useRouteError();
  const message =
    err?.statusText ||
    err?.message ||
    "Something went wrong while loading this page.";

  return (
    <div className="min-h-[70vh] grid place-items-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-[#E8E4DE] bg-white p-8 shadow-sm">
        <div className="text-sm text-stone-500">Core Atoms</div>
        <h1 className="mt-2 text-2xl font-semibold text-stone-900 tracking-tight">Page error</h1>
        <p className="mt-2 text-sm text-stone-600 leading-relaxed">{message}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/"
            className="rounded-xl bg-[#1e3a5f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#16304f] transition"
          >
            Go Home
          </Link>
          <Link
            to="/shop"
            className="rounded-xl border border-[#E8E4DE] bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition"
          >
            Shop
          </Link>
        </div>

        {/* Stack traces leak internals — dev builds only */}
        {import.meta.env.DEV && (
          <details className="mt-6 text-xs text-stone-500">
            <summary className="cursor-pointer hover:text-stone-700 transition">Technical details</summary>
            <pre className="mt-2 overflow-auto rounded-xl border border-[#E8E4DE] bg-stone-50 p-3">
              {String(err?.stack || err?.message || err)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

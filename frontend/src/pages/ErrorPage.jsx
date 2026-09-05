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
import { ArrowRight, TriangleAlert } from "lucide-react";
import useDocumentTitle from "../hooks/useDocumentTitle";

export default function ErrorPage() {
  useDocumentTitle("Error | Core Atoms");
  const err = useRouteError();
  const message =
    err?.statusText ||
    err?.message ||
    "Something went wrong while loading this page.";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-5 py-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-amber-soft text-amber-deep">
        <TriangleAlert className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h1 className="mt-8 font-display text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">Something went wrong</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-stone-600">{message}</p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link to="/" className="btn-primary btn-lg">
          Go home
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <Link to="/shop" className="btn-secondary btn-lg">Browse the range</Link>
      </div>

      {/* Stack traces leak internals — dev builds only */}
      {import.meta.env.DEV && (
        <details className="mt-10 w-full text-left text-xs text-stone-500">
          <summary className="cursor-pointer transition hover:text-ink">Technical details</summary>
          <pre className="mt-2 overflow-auto rounded-xl border border-line bg-bone p-3">
            {String(err?.stack || err?.message || err)}
          </pre>
        </details>
      )}
    </div>
  );
}

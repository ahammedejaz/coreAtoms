/**
 * NotFound.jsx — 404 catch-all page.
 *
 * Displayed for any URL that doesn't match a defined route. A large numeral,
 * the editable title and line from `page_errors`, and links back to Shop and
 * Home.
 *
 * @module pages/NotFound
 */
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { useSiteContent } from "../services/siteContent";

export default function NotFound() {
  useDocumentTitle("Page Not Found | Core Atoms");
  const copy = useSiteContent("page_errors");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-12 text-center">
      <p className="font-display text-[6rem] font-semibold leading-none tracking-[-0.06em] text-ink sm:text-[8.5rem]" aria-hidden="true">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{copy.notFoundTitle}</h1>
      <p className="mt-2 max-w-sm text-sm text-stone-500">{copy.notFoundText}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link to="/shop" className="btn-primary btn-lg">
          Browse the range
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <Link to="/" className="btn-secondary btn-lg">Go home</Link>
      </div>
    </div>
  );
}

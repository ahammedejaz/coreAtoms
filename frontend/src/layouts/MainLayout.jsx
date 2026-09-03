/**
 * MainLayout.jsx — Application shell layout.
 *
 * Wraps every page with a sticky `<Navbar>` on top, a centered `<main>`
 * content area, and a `<Footer>` at the bottom. The `<Outlet>` from
 * react-router renders the matched child route inside the content area.
 *
 * A route can opt out of the centered `max-w-6xl` container by setting
 * `handle: { fullBleed: true }` on its route object — read here via
 * `useMatches()`. Only the home route does this today.
 *
 * @module layouts/MainLayout
 */
import { Suspense } from "react";
import { Outlet, useLocation, useMatches } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ErrorBoundary from "../components/ErrorBoundary";

/** Scrolls to top on every route change. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

/** Minimal centered spinner shown while lazy-loaded routes are loading. */
function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 rounded-full border-3 border-stone-200 border-t-[#1e3a5f] animate-spin" />
    </div>
  );
}

export default function MainLayout() {
  const fullBleed = useMatches().some((m) => m.handle?.fullBleed);
  const content = (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
      <Navbar />
      <main className={fullBleed ? "flex-1" : "flex-1 py-12"}>
        {fullBleed ? content : <div className="mx-auto max-w-6xl px-6">{content}</div>}
      </main>
      <Footer />
    </div>
  );
}

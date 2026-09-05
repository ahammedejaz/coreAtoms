/**
 * MainLayout.jsx — Application shell layout.
 *
 * Wraps every page with the announcement bar, a sticky `<Navbar>`, a `<main>`
 * content area, the `<Footer>` and the slide-over `<CartDrawer>`. The
 * `<Outlet>` from react-router renders the matched child route.
 *
 * A route can opt out of the centred `max-w-6xl` container by setting
 * `handle: { fullBleed: true }` on its route object — read here via
 * `useMatches()`. Only the home route does this today.
 *
 * `<main>` is keyed on the pathname so each route enters with the short
 * `page-enter` rise; query-string changes (shop filters) do not re-run it.
 *
 * @module layouts/MainLayout
 */
import { Suspense, useEffect } from "react";
import { Outlet, useLocation, useMatches } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ErrorBoundary from "../components/ErrorBoundary";
import AnnouncementBar from "../components/AnnouncementBar";
import CartDrawer from "../components/CartDrawer";
import { useAuth } from "../context/AuthContext";

/** Scrolls to top on every route change. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); }, [pathname]);
  return null;
}

/** Minimal centred spinner shown while lazy-loaded routes are loading. */
function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
      <div className="h-8 w-8 rounded-full border-2 border-line-strong border-t-brand animate-spin" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export default function MainLayout() {
  const fullBleed = useMatches().some((m) => m.handle?.fullBleed);
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();

  const content = (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] btn-primary"
      >
        Skip to content
      </a>
      <ScrollToTop />
      {!isAdmin && <AnnouncementBar />}
      <Navbar />
      <main id="main" key={pathname} className={`page-enter ${fullBleed ? "flex-1" : "flex-1 py-10 sm:py-14"}`}>
        {fullBleed ? content : <div className="mx-auto max-w-6xl px-5 sm:px-6">{content}</div>}
      </main>
      <Footer />
      {!isAdmin && <CartDrawer />}
    </div>
  );
}

/**
 * MainLayout.jsx — Application shell layout.
 *
 * Wraps every page with the announcement bar, a sticky `<Navbar>`, a `<main>`
 * content area, the `<Footer>` and the slide-over `<CartDrawer>`, then the
 * storefront's physical layer: Lenis smooth scrolling, the custom scrollbar
 * and reading line, the grain film and the pointer (see `components/fx`).
 * `MotionProvider` decides which of those run on this device and route.
 *
 * Page changes go through `RouteCurtain`: a navy field rises over the page
 * that is leaving, the new page is swapped in and scrolled to the top
 * underneath, then the field lifts. The curtain also holds the leaving
 * route's `fullBleed` flag so the layout does not jump while covered. A
 * route opts out of the centred `max-w-6xl` container by setting
 * `handle: { fullBleed: true }` on its route object; only home does.
 *
 * @module layouts/MainLayout
 */
import { Suspense } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ErrorBoundary from "../components/ErrorBoundary";
import AnnouncementBar from "../components/AnnouncementBar";
import CartDrawer from "../components/CartDrawer";
import { useAuth } from "../context/AuthContext";
import { MotionProvider } from "../context/MotionContext";
import { SmoothScroll, Scrollbar, Cursor, RouteCurtain, Grain } from "../components/fx";

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
  const { isAdmin } = useAuth();
  // The dashboard is a workspace, not a page of the shop: no storefront
  // footer under it, and it manages its own vertical rhythm.
  const isAdminRoute = useLocation().pathname.startsWith("/admin");

  return (
    <MotionProvider>
      <SmoothScroll>
        <div className="min-h-screen flex flex-col">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] btn-primary"
          >
            Skip to content
          </a>
          {!isAdmin && <AnnouncementBar />}
          <Navbar />
          <RouteCurtain>
            {(content, arriving, curtain, fullBleed) => (
              <main
                id="main"
                className={`${curtain ? (arriving ? "page-arrive" : "") : "page-enter"} ${fullBleed || isAdminRoute ? "flex-1" : "flex-1 py-10 sm:py-14"}`}
              >
                <ErrorBoundary>
                  <Suspense fallback={<PageFallback />}>
                    {fullBleed || isAdminRoute ? content : <div className="mx-auto max-w-6xl px-5 sm:px-6">{content}</div>}
                  </Suspense>
                </ErrorBoundary>
              </main>
            )}
          </RouteCurtain>
          {!isAdminRoute && <Footer />}
          {!isAdmin && <CartDrawer />}
        </div>
        <Grain />
        <Scrollbar />
        <Cursor />
      </SmoothScroll>
    </MotionProvider>
  );
}

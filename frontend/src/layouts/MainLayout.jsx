/**
 * MainLayout.jsx — Application shell layout.
 *
 * Wraps every page with a sticky `<Navbar>` on top, a centered `<main>`
 * content area, and a `<Footer>` at the bottom. The `<Outlet>` from
 * react-router renders the matched child route inside the content area.
 *
 * @module layouts/MainLayout
 */
import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ErrorBoundary from "../components/ErrorBoundary";
import FloatingShapes from "../components/FloatingShapes";

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
  return (
    <>
      {/* Floating gradient blobs — fixed behind everything */}
      <FloatingShapes />

      {/* Page shell — sits above the gradients */}
      <div className="min-h-screen flex flex-col relative" style={{ zIndex: 1 }}>
        <ScrollToTop />
        <Navbar />
        <main className="flex-1 py-12">
          <div className="mx-auto max-w-6xl px-6">
            <ErrorBoundary>
              <Suspense fallback={<PageFallback />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

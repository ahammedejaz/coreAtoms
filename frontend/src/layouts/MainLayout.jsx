/**
 * MainLayout.jsx — Application shell layout.
 *
 * Wraps every page with a sticky `<Navbar>` on top, a centered `<main>`
 * content area, and a `<Footer>` at the bottom. The `<Outlet>` from
 * react-router renders the matched child route inside the content area.
 *
 * @module layouts/MainLayout
 */
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ErrorBoundary from "../components/ErrorBoundary";

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FAFAF8" }}>
      <Navbar />
      <main className="flex-1 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/**
 * Navbar.jsx — Sticky navigation bar with mobile drawer.
 *
 * Features:
 * - Dynamic logo (fetched from `app_settings.site_logo` or fallback "CA" monogram)
 * - Role-aware nav links (admin sees Admin link, customers see Home/Shop/Orders)
 * - Cart badge with bounce animation on add
 * - Inline toast for cart notifications (driven by `lastAction` from CartContext)
 * - Responsive mobile hamburger menu with backdrop overlay
 * - Prevents body scroll when mobile menu is open
 *
 * @module components/Navbar
 */
import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase/client";

const navLinkClass = ({ isActive }) =>
  `nav-shine text-sm transition ${isActive ? "text-neutral-950 font-semibold" : "text-neutral-600 hover:text-neutral-950"}`;

const mobileNavLinkClass = ({ isActive }) =>
  `block px-4 py-3 rounded-xl text-sm font-medium transition ${isActive
    ? "bg-[#1e3a5f]/8 text-[#1e3a5f] font-semibold"
    : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950"
  }`;

export default function Navbar() {
  const { totalItems, lastAction, maxItems } = useCart();
  const { isAuthenticated, user, isAdmin, signOut, profile } = useAuth();
  const homePath = isAdmin ? "/admin" : "/";
  const location = useLocation();

  const [bump, setBump] = useState(false);
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Close mobile menu on Escape key
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && menuOpen) setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Load site logo
  useEffect(() => {
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "site_logo")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "string" && data.value.startsWith("http")) {
          setLogoUrl(data.value);
        }
      });
  }, []);

  const toastText = useMemo(() => {
    if (!lastAction) return null;
    if (lastAction.type === "limit") return lastAction.message || `Max ${maxItems} items per order`;
    return null;
  }, [lastAction, maxItems]);

  useEffect(() => {
    if (!toastText) return;
    setBump(true);
    setToast(toastText);
    const t1 = setTimeout(() => setBump(false), 220);
    const t2 = setTimeout(() => setToast(null), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [toastText]);

  // Prevent body scroll when menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const LogoMark = () => (
    logoUrl ? (
      <img src={logoUrl} alt="Core Atoms" className="h-8 w-auto max-w-[140px] object-contain" />
    ) : (
      <img src="/logo.png" alt="Core Atoms" className="h-8 w-auto max-w-[140px] object-contain" />
    )
  );

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl backdrop-saturate-[180%] shadow-[0_1px_3px_rgba(0,0,0,0.05),0_8px_30px_-12px_rgba(30,58,95,0.15)]" style={{ borderBottom: '1px solid rgba(232,228,222,0.6)' }}>
        {/* Subtle gradient glow line at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#1e3a5f]/15 to-transparent" />
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">

          {/* Logo */}
          <Link to={homePath} className="flex items-center gap-2.5">
            <LogoMark />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-5">
            {!isAdmin && (
              <>
                <NavLink to="/" className={navLinkClass}>Home</NavLink>
                <NavLink to="/shop" className={navLinkClass}>Shop</NavLink>
              </>
            )}
            {isAuthenticated ? (
              <>
                {!isAdmin && <NavLink to="/orders" className={navLinkClass}>My Orders</NavLink>}
                {isAdmin && <NavLink to="/admin" className={navLinkClass}>Admin</NavLink>}
                <button onClick={signOut} className="nav-shine text-sm text-neutral-600 hover:text-neutral-950 transition">Logout</button>
                <span className="hidden lg:inline text-xs text-neutral-400 max-w-[140px] truncate">{user?.email}</span>
              </>
            ) : (
              <NavLink to="/login" className={navLinkClass}>Login</NavLink>
            )}

            {!isAdmin && (
              <Link to="/cart"
                className={`cart-shine ml-1 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 relative overflow-hidden transition-all duration-300 hover:border-[#1e3a5f]/20 hover:shadow-[0_2px_12px_rgba(30,58,95,0.12)] hover:-translate-y-px active:translate-y-0.5 active:scale-[0.97] ${bump ? "scale-[1.06]" : "scale-100"}`}
                title="Cart">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 13.846 4.632 15 6.414 15H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 5H6.28l-.31-1.243A1 1 0 005 3H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg>
                Cart
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-neutral-900 text-white px-1 text-[10px]">{totalItems}</span>
              </Link>
            )}
          </nav>

          {/* Mobile right-side: cart + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            {!isAdmin && (
              <Link to="/cart"
                className={`inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-900 shadow-sm transition ${bump ? "scale-[1.06]" : "scale-100"}`}>
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 13.846 4.632 15 6.414 15H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 5H6.28l-.31-1.243A1 1 0 005 3H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg>
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-neutral-900 text-white px-1 text-[10px]">{totalItems}</span>
              </Link>
            )}

            {/* Hamburger */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="h-9 w-9 rounded-xl border border-neutral-200 bg-white flex items-center justify-center text-neutral-700 hover:bg-neutral-50 transition shadow-sm"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile drawer — slides down below the header */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${menuOpen ? "max-h-screen border-t border-neutral-100" : "max-h-0"}`}>
          <nav className="px-4 py-3 space-y-1 bg-white">
            {!isAdmin && (
              <>
                <NavLink to="/" className={mobileNavLinkClass}>
                  <span className="flex items-center gap-3">
                    <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                    Home
                  </span>
                </NavLink>
                <NavLink to="/shop" className={mobileNavLinkClass}>
                  <span className="flex items-center gap-3">
                    <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 13.846 4.632 15 6.414 15H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 5H6.28l-.31-1.243A1 1 0 005 3H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg>
                    Shop
                  </span>
                </NavLink>
              </>
            )}

            {isAuthenticated ? (
              <>
                {!isAdmin && (
                  <NavLink to="/orders" className={mobileNavLinkClass}>
                    <span className="flex items-center gap-3">
                      <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
                      My Orders
                    </span>
                  </NavLink>
                )}
                {isAdmin && (
                  <NavLink to="/admin" className={mobileNavLinkClass}>
                    <span className="flex items-center gap-3">
                      <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                      Admin Dashboard
                    </span>
                  </NavLink>
                )}

                {/* User info */}
                <div className="px-4 py-2 rounded-xl bg-stone-50 flex items-center justify-between mt-1">
                  <div className="text-xs text-neutral-500 truncate max-w-[200px]">{user?.email}</div>
                  {isAdmin && <span className="text-[10px] rounded-full bg-[#1e3a5f]/10 text-[#1e3a5f] px-2 py-0.5 font-semibold">Admin</span>}
                </div>

                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition mt-1"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" /></svg>
                  Logout
                </button>
              </>
            ) : (
              <NavLink to="/login" className={mobileNavLinkClass}>
                <span className="flex items-center gap-3">
                  <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  Login
                </span>
              </NavLink>
            )}
          </nav>
        </div>
      </header>

      {/* Toast notification */}
      {toast && (
        <div className="pointer-events-none fixed right-4 top-20 z-[60]">
          <div className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-900 shadow-lg animate-toast-in">
            {toast}
          </div>
        </div>
      )}

      {/* Mobile menu backdrop */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setMenuOpen(false)}
          style={{ top: "57px" }}
        />
      )}
    </>
  );
}

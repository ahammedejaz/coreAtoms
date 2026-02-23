import { Link, NavLink } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { totalItems, lastAction, maxItems } = useCart();
  const { isAuthenticated, user, isAdmin, signOut, profile } = useAuth();
  const homePath = isAdmin ? "/admin" : "/";

  const [bump, setBump] = useState(false);
  const [toast, setToast] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const toastText = useMemo(() => {
    if (!lastAction) return null;
    if (lastAction.type === "add") return `Added ${lastAction.qty} × ${lastAction.name}`;
    if (lastAction.type === "limit") return lastAction.message || `Max ${maxItems} items per order`;
    return null;
  }, [lastAction, maxItems]);

  useEffect(() => {
    if (!toastText) return;
    setBump(true);
    setToast(toastText);
    const t1 = setTimeout(() => setBump(false), 220);
    const t2 = setTimeout(() => setToast(null), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [toastText]);

  const navLink = ({ isActive }) =>
    `text-sm font-medium transition-colors duration-150 ${
      isActive ? "text-[#1e3a5f]" : "text-stone-500 hover:text-stone-900"
    }`;

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md border-b border-[#E8E4DE] shadow-[0_4px_24px_rgba(0,0,0,0.07)]"
          : "bg-white/80 backdrop-blur-sm border-b border-[#E8E4DE]/60"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 h-16">

        {/* Logo */}
        <Link to={homePath} className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-xl bg-[#1e3a5f] grid place-items-center shadow-sm group-hover:shadow transition-shadow">
            <span className="text-xs font-bold text-white tracking-wider">CA</span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-stone-900">Core Atoms</div>
            <div className="text-[10px] font-medium tracking-widest text-stone-400 uppercase">Nutraceuticals</div>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-6">
          {!isAdmin && (
            <>
              <NavLink to="/" className={navLink}>Home</NavLink>
              <NavLink to="/shop" className={navLink}>Shop</NavLink>
            </>
          )}

          {isAuthenticated ? (
            <>
              {!isAdmin && <NavLink to="/orders" className={navLink}>My Orders</NavLink>}
              {isAdmin && <NavLink to="/admin" className={navLink}>Dashboard</NavLink>}

              <div className="flex items-center gap-3 pl-2 border-l border-[#E8E4DE]">
                <span className="hidden sm:block text-xs text-stone-400 max-w-[140px] truncate">{user?.email}</span>
                {isAdmin && (
                  <span className="hidden md:inline-flex items-center rounded-full bg-[#EFF6FF] border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-[#1e3a5f]">
                    Admin
                  </span>
                )}
                <button
                  onClick={signOut}
                  className="text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <NavLink to="/login" className={navLink}>Sign in</NavLink>
          )}

          {/* Cart pill */}
          {!isAdmin && (
            <Link
              to="/cart"
              className={`ml-1 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                bump
                  ? "border-[#1e3a5f] bg-[#1e3a5f] text-white scale-[1.06]"
                  : totalItems > 0
                    ? "border-[#1e3a5f] bg-[#1e3a5f] text-white"
                    : "border-[#E8E4DE] bg-white text-stone-700 hover:border-stone-300"
              }`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
              </svg>
              Cart
              {totalItems > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white/20 text-white px-1 text-[10px] font-bold">
                  {totalItems}
                </span>
              )}
            </Link>
          )}
        </nav>
      </div>

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed right-5 top-20 z-[60]">
          <div
            className="rounded-2xl border border-[#E8E4DE] bg-white px-4 py-3 text-sm text-stone-900 shadow-xl"
            style={{ animation: "toastIn 0.22s ease-out" }}
          >
            <div className="font-semibold">{toast}</div>
          </div>
        </div>
      )}
    </header>
  );
}

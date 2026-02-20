import { Link, NavLink } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

const navLinkClass = ({ isActive }) =>
  `text-sm transition ${isActive ? "text-neutral-950" : "text-neutral-600 hover:text-neutral-950"}`;

export default function Navbar() {
  const { totalItems, lastAction, maxItems } = useCart();
  const { isAuthenticated, user, isAdmin, signOut, profile } = useAuth();

  const [bump, setBump] = useState(false);
  const [toast, setToast] = useState(null);

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
    const t2 = setTimeout(() => setToast(null), 2200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [toastText]);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-100 grid place-items-center shadow-sm">
            <span className="text-xs font-semibold text-neutral-900">CA</span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-neutral-950">Core Atoms</div>
            <div className="text-[11px] text-neutral-500">Nutraceuticals</div>
          </div>
        </Link>

        <nav className="flex items-center gap-5">
          <NavLink to="/" className={navLinkClass}>Home</NavLink>
          <NavLink to="/shop" className={navLinkClass}>Shop</NavLink>

          {isAuthenticated ? (
            <>
              <NavLink to="/orders" className={navLinkClass}>My Orders</NavLink>
              {isAdmin && <NavLink to="/admin" className={navLinkClass}>Admin</NavLink>}
              <button
                onClick={signOut}
                className="text-sm text-neutral-600 hover:text-neutral-950 transition"
              >
                Logout
              </button>
              <span className="hidden sm:inline text-xs text-neutral-500">
                {user?.email}
              </span>
              {isAdmin && (
                <span className="hidden md:inline text-xs text-neutral-400">
                  role: {profile?.role || "admin"}
                </span>
              )}
            </>
          ) : (
            <NavLink to="/login" className={navLinkClass}>Login</NavLink>
          )}

          <Link
            to="/cart"
            className={`ml-2 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-900 shadow-sm hover:shadow transition ${
              bump ? "scale-[1.06]" : "scale-100"
            }`}
            title="Cart items"
          >
            Cart
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-neutral-900 text-white px-1">
              {totalItems}
            </span>
          </Link>
        </nav>
      </div>

      {toast && (
        <div className="pointer-events-none fixed right-4 top-20 z-[60]">
          <div className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-900 shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </header>
  );
}

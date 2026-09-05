/**
 * CartDrawer.jsx — Slide-over cart that opens on every add-to-cart.
 *
 * Reads items from `CartContext` and opens itself when `lastAction` reports
 * a successful add, so product cards and the PDP never need to know about
 * it. Quantity steppers, removal, a free-shipping meter and the two exits
 * (checkout, full cart page) live here; pricing settings come from the
 * cached `fetchPricingSettings()`.
 *
 * Dialog behaviour: Escape closes, focus lands on the close button, the
 * page behind can't scroll and is `inert` to assistive tech, and the panel
 * is always mounted so the exit can animate.
 *
 * @module components/CartDrawer
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ImageOff, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useCartDrawer } from "../context/CartDrawerContext";
import { fetchPricingSettings, EMPTY_PRICING } from "../services/settings";
import { money } from "../utils/format";

function LineImage({ src, alt }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className="h-full w-full grid place-items-center text-stone-300" aria-hidden="true">
        <ImageOff className="h-5 w-5" strokeWidth={1.5} />
      </div>
    );
  }
  return <img src={src} alt={alt} className="product-img h-full w-full object-cover" loading="lazy" onError={() => setBroken(true)} />;
}

export default function CartDrawer() {
  const { items, totalItems, subtotal, updateQty, removeItem, lastAction } = useCart();
  const { isOpen, open, close } = useCartDrawer();
  const navigate = useNavigate();
  const location = useLocation();
  const [pricing, setPricing] = useState(EMPTY_PRICING);
  const closeRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    let on = true;
    fetchPricingSettings().then((p) => { if (on) setPricing(p); });
    return () => { on = false; };
  }, []);

  // Every successful add opens the drawer — except on the cart and checkout
  // pages, where the cart is already the whole screen.
  useEffect(() => {
    if (lastAction?.type !== "add") return;
    if (location.pathname === "/cart" || location.pathname === "/checkout") return;
    open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAction]);

  // Close on navigation.
  useEffect(() => { close(); }, [location.pathname, close]);

  // Scroll lock, Escape, focus in/out.
  useEffect(() => {
    if (!isOpen) return;
    restoreRef.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => closeRef.current?.focus(), 60);
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus();
    };
  }, [isOpen, close]);

  const sub = Number(subtotal || 0);
  const freeMin = pricing.freeShippingMin;
  const progress = freeMin > 0 ? Math.min(100, Math.round((sub / freeMin) * 100)) : 0;
  const remaining = freeMin > 0 ? Math.max(0, freeMin - sub) : 0;
  const unlocked = freeMin > 0 && sub >= freeMin;

  const lines = useMemo(() => items || [], [items]);

  return (
    <div className={`fixed inset-0 z-[70] ${isOpen ? "" : "pointer-events-none"}`} inert={!isOpen} aria-hidden={!isOpen}>
      {/* Scrim */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`absolute inset-0 bg-navy-950/45 backdrop-blur-[2px] transition-opacity ${isOpen ? "duration-300 opacity-100" : "duration-200 opacity-0"}`}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        className={`absolute inset-y-0 right-0 flex w-full max-w-[26rem] flex-col bg-white shadow-drawer transition-transform ease-drawer ${isOpen ? "duration-[420ms] translate-x-0" : "duration-[260ms] translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 h-16 shrink-0">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
              Your cart
              {totalItems > 0 && <span className="ml-2 text-sm font-medium text-stone-400 tabular-nums">{totalItems} item{totalItems !== 1 ? "s" : ""}</span>}
            </h2>
          </div>
          <button ref={closeRef} type="button" onClick={close} className="btn-icon" aria-label="Close cart">
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {/* Free shipping meter */}
        {freeMin > 0 && lines.length > 0 && (
          <div className="border-b border-line px-5 py-3.5 bg-bone/60">
            <p className="text-[13px] text-stone-700">
              {unlocked
                ? <><span className="font-semibold text-emerald-700">Free shipping unlocked.</span> Nice.</>
                : <>Add <span className="font-semibold text-ink tabular-nums">{money(remaining)}</span> more for free shipping</>}
            </p>
            <div className={`meter mt-2 ${unlocked ? "is-complete" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Progress to free shipping">
              <span style={{ "--meter": progress / 100 }} />
            </div>
          </div>
        )}

        {/* Lines */}
        <div className="flex-1 overflow-y-auto px-5">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center py-16">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-bone text-brand">
                <ShoppingBag className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <p className="mt-5 font-display text-xl font-semibold tracking-tight text-ink">Nothing here yet</p>
              <p className="mt-1.5 max-w-[22ch] text-sm text-stone-500">Add a formula and it will show up here, ready for checkout.</p>
              <Link to="/shop" onClick={close} className="btn-primary mt-6">
                Browse the range
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {lines.map((item) => {
                const lineTotal = (Number(item.unitPrice) || 0) * (Number(item.qty) || 0);
                return (
                  <li key={item.id} className="flex gap-4 py-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-bone">
                      <LineImage src={item.image} alt="" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[14px] font-semibold leading-snug text-ink line-clamp-2">{item.name}</p>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="shrink-0 rounded-full p-1 text-stone-400 transition-colors hover:text-red-600"
                          aria-label={`Remove ${item.name}`}
                        >
                          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500 tabular-nums">{money(item.unitPrice)} each</p>
                      <div className="mt-2.5 flex items-center justify-between">
                        <div className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-white p-0.5">
                          <button
                            type="button"
                            onClick={() => (item.qty <= 1 ? removeItem(item.id) : updateQty(item.id, item.qty - 1))}
                            className="grid h-7 w-7 place-items-center rounded-full text-stone-600 transition-colors hover:bg-bone hover:text-ink"
                            aria-label={item.qty <= 1 ? "Remove" : "Decrease quantity"}
                          >
                            <Minus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold tabular-nums text-ink">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.id, item.qty + 1)}
                            className="grid h-7 w-7 place-items-center rounded-full text-stone-600 transition-colors hover:bg-bone hover:text-ink"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                          </button>
                        </div>
                        <span className="font-display text-[15px] font-semibold tabular-nums text-ink">{money(lineTotal)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {lines.length > 0 && (
          <div className="border-t border-line px-5 pt-4 pb-5 shrink-0 bg-white" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-stone-600">Subtotal</span>
              <span className="font-display text-xl font-semibold tabular-nums text-ink">{money(sub)}</span>
            </div>
            <p className="mt-1 text-xs text-stone-400">Shipping, GST and coupons are worked out at checkout.</p>
            <button type="button" onClick={() => { close(); navigate("/checkout"); }} className="btn-primary btn-lg mt-4 w-full">
              Checkout
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
            <Link to="/cart" onClick={close} className="mt-3 block text-center text-sm font-semibold text-brand hover:underline underline-offset-4">
              View full cart
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

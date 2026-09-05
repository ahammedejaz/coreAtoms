/**
 * StickyAddToCart.jsx — Mobile-only bar fixed to the bottom of the PDP.
 *
 * Hidden at `lg` and above, where the desktop add-to-cart controls in the
 * buy column are already visible. The toast container is top-right
 * (`context/ToastContext.jsx`), so this bar never covers it.
 *
 * @param {{ price, mrp, offPct, inStock, canAdd, cartQty, onAdd, onViewCart }} props
 * @module components/StickyAddToCart
 */
import { ShoppingBag } from "lucide-react";
import { money } from "../utils/format";

export default function StickyAddToCart({ price, mrp, offPct, inStock, canAdd, cartQty, onAdd, onViewCart }) {
  return (
    <div
      className="glass fixed inset-x-0 bottom-0 z-40 border-t px-4 pt-3 shadow-[0_-12px_32px_-16px_rgba(8,19,42,0.35)] transition-[translate,opacity] duration-300 ease-out-strong starting:translate-y-full starting:opacity-0 lg:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl font-semibold tabular-nums tracking-tight text-ink">{money(price)}</span>
            {offPct && <s className="text-xs text-stone-400 tabular-nums">{money(mrp)}</s>}
          </div>
          <div className={`text-[11.5px] font-medium ${inStock ? "text-emerald-700" : "text-red-700"}`}>{inStock ? "In stock" : "Out of stock"}</div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {cartQty > 0 && (
            <button type="button" onClick={onViewCart} className="btn-secondary px-4 py-2.5">
              Cart ({cartQty})
            </button>
          )}
          <button
            type="button"
            onClick={onAdd}
            disabled={!canAdd}
            className="btn-primary px-5 py-2.5 disabled:opacity-40"
          >
            <ShoppingBag className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            {!inStock ? "Sold out" : cartQty > 0 ? "Add another" : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  );
}

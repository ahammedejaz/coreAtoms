/**
 * StickyAddToCart.jsx — Mobile-only bar fixed to the bottom of the PDP.
 *
 * Hidden at `lg` and above, where the desktop add-to-cart controls in the
 * info column are already visible. The toast container is top-right
 * (`context/ToastContext.jsx`), so this bar never covers it.
 *
 * @param {{ price, mrp, offPct, inStock, canAdd, cartQty, onAdd, onViewCart }} props
 * @module components/StickyAddToCart
 */
import { money } from "../utils/format";

export default function StickyAddToCart({ price, mrp, offPct, inStock, canAdd, cartQty, onAdd, onViewCart }) {
  return (
    <div
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur px-4 pt-3"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-stone-900">{money(price)}</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {offPct && (
              <>
                <s className="text-xs text-stone-400 font-normal">{money(mrp)}</s>
                <span className="text-[11px] font-semibold text-emerald-600">{offPct}% off</span>
              </>
            )}
          </div>
          <div className="text-[11px] text-stone-500">{inStock ? "In stock" : "Out of stock"}</div>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {cartQty > 0 && (
            <button type="button" onClick={onViewCart} className="btn-ghost py-2.5 px-4">
              View cart ({cartQty})
            </button>
          )}
          <button
            type="button"
            onClick={onAdd}
            disabled={!canAdd}
            className="btn-primary py-2.5 px-5 disabled:opacity-40"
          >
            {!inStock ? "Out of stock" : cartQty > 0 ? "Add more" : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  );
}

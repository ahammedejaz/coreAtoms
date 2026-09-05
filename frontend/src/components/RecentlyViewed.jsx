/**
 * RecentlyViewed.jsx — Horizontal strip of products the visitor opened
 * recently. Renders nothing until there is at least one other product to
 * show, so it never leaves an empty heading behind.
 *
 * @param {{ excludeId?: string, gstPercent?: number, className?: string }} props
 * @module components/RecentlyViewed
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import useRecentlyViewed from "../hooks/useRecentlyViewed";
import { fetchProductsCached } from "../services/products";
import { useCart } from "../context/CartContext";
import ProductCard from "./ProductCard";

export default function RecentlyViewed({ excludeId, gstPercent = 0, className = "" }) {
  const { ids } = useRecentlyViewed();
  const { addItem } = useCart();
  const [products, setProducts] = useState([]);
  const [justAddedId, setJustAddedId] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const wanted = ids.filter((id) => id !== String(excludeId));
  const wantedKey = wanted.join("|");

  // One catalogue read; the visible list is derived below so removing the
  // current product (or clearing the list) never needs a state write.
  useEffect(() => {
    if (!wantedKey) return;
    let on = true;
    fetchProductsCached()
      .then((list) => { if (on) setProducts(list); })
      .catch(() => { if (on) setProducts([]); });
    return () => { on = false; };
  }, [wantedKey]);

  const visible = useMemo(() => {
    const byId = new Map(products.map((p) => [String(p.id), p]));
    return wanted.map((id) => byId.get(id)).filter((p) => p && p.isActive !== false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, wantedKey]);

  const handleAdd = useCallback((p) => {
    addItem(p, 1);
    setJustAddedId(p.id);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAddedId(null), 1000);
  }, [addItem]);

  if (visible.length === 0) return null;

  return (
    <section className={className} aria-labelledby="recently-viewed-heading">
      <div className="mb-6 flex items-center gap-2.5">
        <Clock className="h-4 w-4 text-stone-400" strokeWidth={1.75} aria-hidden="true" />
        <h2 id="recently-viewed-heading" className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">Recently viewed</h2>
      </div>
      <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 scroll-px-5 no-scrollbar sm:-mx-6 sm:px-6 sm:scroll-px-6">
        {visible.map((p) => (
          <div key={p.id} className="w-[44vw] max-w-[220px] shrink-0 snap-start sm:w-56">
            <ProductCard p={p} onAdd={handleAdd} justAdded={justAddedId === p.id} gstPercent={gstPercent} />
          </div>
        ))}
      </div>
    </section>
  );
}

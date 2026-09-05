/**
 * RelatedProducts.jsx — "You may also like" strip for the product page.
 *
 * Shows up to four other active products, preferring the same category and
 * topping up from the rest of the catalogue when the category is small.
 * Add-to-cart works right from the strip via the shared ProductCard.
 *
 * Deliberately quiet on failure: this is a cross-sell aid, so a fetch error
 * or an empty catalogue renders nothing rather than an error state on an
 * otherwise healthy product page.
 *
 * @module components/RelatedProducts
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { fetchProductsCached } from "../services/products";
import { useCart } from "../context/CartContext";
import ProductCard from "./ProductCard";

export default function RelatedProducts({ productId, category, gstPercent = 0 }) {
  const { addItem } = useCart();
  const [related, setRelated] = useState([]);
  const [justAddedId, setJustAddedId] = useState(null);
  const btnTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(btnTimerRef.current), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await fetchProductsCached();
        if (!alive) return;
        const others = list.filter((p) => p.id !== productId && p.isActive !== false);
        const same = others.filter((p) => p.category && p.category === category);
        const rest = others.filter((p) => !same.includes(p));
        setRelated([...same, ...rest].slice(0, 4));
      } catch {
        if (alive) setRelated([]);
      }
    })();
    return () => { alive = false; };
  }, [productId, category]);

  const handleAdd = useCallback((p) => {
    addItem(p, 1);
    setJustAddedId(p.id);
    clearTimeout(btnTimerRef.current);
    btnTimerRef.current = setTimeout(() => setJustAddedId(null), 1000);
  }, [addItem]);

  if (related.length === 0) return null;

  return (
    <section className="mx-auto mt-16 max-w-6xl border-t border-line px-5 pt-12 sm:px-6" aria-labelledby="related-heading">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 id="related-heading" className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">You may also like</h2>
        <Link to={category ? `/shop?category=${encodeURIComponent(category)}` : "/shop"} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline underline-offset-4">
          More {category ? "in this range" : "products"}
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-x-6">
        {related.map((p) => (
          <ProductCard key={p.id} p={p} onAdd={handleAdd} justAdded={justAddedId === p.id} gstPercent={gstPercent} />
        ))}
      </div>
    </section>
  );
}

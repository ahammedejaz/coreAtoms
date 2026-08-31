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
import { fetchProducts } from "../services/products";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import ProductCard from "./ProductCard";

export default function RelatedProducts({ productId, category, gstPercent = 0 }) {
    const { addItem } = useCart();
    const { showToast } = useToast();
    const [related, setRelated] = useState([]);
    const [justAddedId, setJustAddedId] = useState(null);
    const btnTimerRef = useRef(null);

    useEffect(() => () => clearTimeout(btnTimerRef.current), []);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const list = await fetchProducts();
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
        showToast(`${p.name} added to cart`, "success");
        clearTimeout(btnTimerRef.current);
        btnTimerRef.current = setTimeout(() => setJustAddedId(null), 1000);
    }, [addItem, showToast]);

    if (related.length === 0) return null;

    return (
        <div className="mx-auto max-w-6xl px-4 mt-6">
            <div className="rounded-2xl border border-[#E8E4DE] bg-white p-4 sm:p-7">
                <div className="mb-5">
                    <p className="section-label">Keep exploring</p>
                    <h2 className="mt-1 text-base font-semibold text-stone-900">You may also like</h2>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {related.map((p) => (
                        <ProductCard key={p.id} p={p} onAdd={handleAdd} justAdded={justAddedId === p.id} gstPercent={gstPercent} />
                    ))}
                </div>
            </div>
        </div>
    );
}

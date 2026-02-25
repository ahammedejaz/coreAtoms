/**
 * Shop.jsx — Product listing page with search, category filter, and add-to-cart.
 *
 * Fetches all active products from Supabase and displays them in a responsive
 * grid. Includes a search bar, category filter dropdown, skeleton loading
 * states, and an inline toast notification on add-to-cart.
 *
 * Also exports the `ProductCard` and `Stars` sub-components used by `Home.jsx`.
 *
 * @module pages/Shop
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchProducts } from "../services/products";
import { useCart } from "../context/CartContext";
import useDebounce from "../hooks/useDebounce";
import SEO from "../components/SEO";
import { useToast } from "../context/ToastContext";
import ScrollReveal from "../components/ScrollReveal";

import { money } from "../utils/format";

export function Stars({ rating, count }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`text-[13px] leading-none ${i <= Math.round(rating) ? "text-amber-400" : "text-stone-200"}`}>★</span>
      ))}
      <span className="text-[11px] text-stone-400 ml-0.5">{Number(rating).toFixed(1)} ({count})</span>
    </div>
  );
}

export const ProductCard = React.memo(function ProductCard({ p, onAdd, justAdded }) {
  const out = (p.stockQty ?? 0) <= 0;
  const desc = String(p.description || "").replace(/\s+/g, " ").trim().slice(0, 110) ||
    "Premium daily supplement with clean ingredients and reliable quality.";

  return (
    <div className="group flex flex-col rounded-2xl border border-[#E8E4DE] bg-white overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 transition-all duration-250">

      {/* Image */}
      <Link to={`/product/${p.id}`} className="block relative overflow-hidden bg-stone-50" style={{ height: "220px" }}>
        <img
          src={p.image}
          alt={p.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          style={{ objectPosition: p.imagePosition || "50% 50%" }}
          loading="lazy"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {/* Category */}
        {p.category && (
          <div className="absolute top-3 left-3">
            <span className="rounded-full bg-white border border-[#E8E4DE] px-2.5 py-1 text-[10px] font-semibold text-stone-600 shadow-sm">
              {p.category}
            </span>
          </div>
        )}
        {/* Stock */}
        <div className="absolute top-3 right-3">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold border ${out ? "bg-red-50 border-red-200 text-red-600" : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}>
            <span className="inline-flex items-center gap-1">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${out ? "bg-red-500" : "bg-emerald-500"}`} />
              {out ? "Out of stock" : "In stock"}
            </span>
          </span>
        </div>
      </Link>

      {/* Body */}
      <div className="flex flex-col flex-1 p-5">

        {/* 1. Name — 2 lines max */}
        <Link to={`/product/${p.id}`}>
          <h3 className="text-[15px] font-semibold text-stone-900 leading-snug line-clamp-2 group-hover:text-[#1e3a5f] transition-colors">
            {p.name}
          </h3>
        </Link>

        {/* 2. Rating — always reserves space so cards stay aligned */}
        <div className="mt-1.5 h-5 flex items-center">
          {p.reviewCount > 0 && <Stars rating={p.avgRating} count={p.reviewCount} />}
        </div>

        {/* 3. Description — 2 lines max */}
        <p className="mt-2 text-[13px] text-stone-500 leading-relaxed line-clamp-2">{desc}</p>

        {/* 4. Highlights — pushed to sit just above price */}
        <div className="mt-auto pt-3 flex flex-wrap gap-1.5">
          {(p.highlights && p.highlights.length > 0
            ? p.highlights.slice(0, 3)
            : ["Clean label", "Lab-tested", "COD available"]
          ).map((tag) => (
            <span key={tag} className="rounded-full border border-[#E8E4DE] bg-stone-50 px-2.5 py-0.5 text-[10px] font-medium text-stone-500">{tag}</span>
          ))}
        </div>

        {/* 5. Price + button */}
        <div className="pt-4">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <span className="text-[11px] text-stone-400 block mb-0.5">
                {p.variants && p.variants.length > 0 ? "Starting from" : "Price"}
              </span>
              <span className="text-lg font-semibold text-stone-900">
                {p.variants && p.variants.length > 0 ? "From " : ""}{money(p.price)}
              </span>
            </div>
            <Link to={`/product/${p.id}`} className="text-[12px] font-semibold text-[#1e3a5f] hover:underline underline-offset-2">
              Details →
            </Link>
          </div>

          {/* Variant hint chips on card */}
          {p.variants && p.variants.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {p.variants.slice(0, 3).map((v) => (
                <span key={v.id} className="rounded-full border border-[#1e3a5f]/20 bg-[#EFF6FF] px-2.5 py-0.5 text-[10px] font-medium text-[#1e3a5f]">
                  {v.label}
                </span>
              ))}
              {p.variants.length > 3 && (
                <span className="rounded-full border border-[#E8E4DE] bg-stone-50 px-2.5 py-0.5 text-[10px] text-stone-400">
                  +{p.variants.length - 3} more
                </span>
              )}
            </div>
          )}

          {p.variants && p.variants.length > 0 ? (
            // Has variants → must pick on detail page
            <Link
              to={`/product/${p.id}`}
              className="block w-full text-center rounded-xl px-4 py-2.5 text-sm font-semibold border border-[#1e3a5f] bg-[#1e3a5f] text-white hover:bg-[#162d4a] shadow-sm hover:shadow transition-all duration-200"
            >
              Select option →
            </Link>
          ) : (
            <button
              onClick={() => onAdd(p)}
              disabled={out}
              type="button"
              className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold border transition-all duration-200 ${out
                ? "border-stone-200 bg-stone-100 text-stone-400 cursor-not-allowed"
                : justAdded
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-[#1e3a5f] bg-[#1e3a5f] text-white hover:bg-[#162d4a] shadow-sm hover:shadow"
                }`}
            >
              {justAdded ? "Added to cart ✓" : out ? "Out of stock" : "Add to cart"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default function Shop() {
  const { addItem } = useCart();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // URL-synced filters — survive refresh and are shareable
  const category = searchParams.get("category") || "All";
  const query = searchParams.get("q") || "";
  const setCategory = (cat) => {
    setSearchParams((prev) => {
      if (cat === "All") prev.delete("category"); else prev.set("category", cat);
      return prev;
    });
  };
  const setQuery = (q) => {
    setSearchParams((prev) => {
      if (!q.trim()) prev.delete("q"); else prev.set("q", q);
      return prev;
    });
  };

  // Debounce search for performance
  const debouncedQuery = useDebounce(query, 300);

  const [justAddedId, setJustAddedId] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { setLoading(true); const list = await fetchProducts(); if (alive) setProducts(list); }
      catch (e) { if (alive) setErr(e?.message || "Failed to load"); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => { const c = (p.category || "").trim(); if (c) set.add(c); });
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  const active = useMemo(() => {
    let list = products.filter((p) => p.isActive !== false);
    if (category !== "All") list = list.filter((p) => p.category === category);
    const q = debouncedQuery.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return list;
  }, [products, category, debouncedQuery]);

  /** Ref for button feedback timer. */
  const btnTimerRef = useRef(null);

  /** Cleanup timer on unmount. */
  useEffect(() => {
    return () => clearTimeout(btnTimerRef.current);
  }, []);

  /** Handles adding a product to cart with toast + button feedback. */
  const handleAdd = (p) => {
    addItem(p, 1);
    setJustAddedId(p.id);
    showToast(`${p.name} added to cart`, "success");
    clearTimeout(btnTimerRef.current);
    btnTimerRef.current = setTimeout(() => setJustAddedId(null), 1000);
  };

  if (loading) return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 py-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-[#E8E4DE] bg-white overflow-hidden animate-pulse">
          <div className="h-[220px] bg-stone-100" />
          <div className="p-5 space-y-3">
            <div className="h-4 bg-stone-100 rounded w-3/4" />
            <div className="h-3 bg-stone-100 rounded w-full" />
            <div className="h-3 bg-stone-100 rounded w-2/3" />
            <div className="h-10 bg-stone-100 rounded-xl mt-4" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      {/* Page header */}
      <ScrollReveal>
        <div className="mb-8">
          <SEO title="Shop | Core Atoms" description="Browse our full range of premium nutraceuticals. Clean labels, lab-tested, COD available across India." />
          <p className="section-label">Our Collection</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">Shop</h1>
          <p className="mt-2 text-sm text-stone-500">Premium supplements, clean labels, COD available across India.</p>
        </div>
      </ScrollReveal>

      {/* Filters */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-stone-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="w-full sm:w-60 rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/10 focus:border-[#1e3a5f] outline-none transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-stone-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-.553.894l-4 2A1 1 0 017 19v-8.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
            </svg>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/10 focus:border-[#1e3a5f] outline-none transition"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-sm text-stone-400">
          {active.length} product{active.length !== 1 ? "s" : ""}
        </p>
      </div>


      {err && (
        <div className="card p-6 mb-6 text-sm text-red-600">{err}</div>
      )}

      <ScrollReveal delay={100}>
        {active.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-base font-semibold text-stone-900">No products found</p>
            <p className="mt-1 text-sm text-stone-500">Try a different search or category.</p>
            <button onClick={() => { setCategory("All"); setQuery(""); }} className="btn-ghost mt-5">Reset filters</button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((p) => (
              <ProductCard key={p.id} p={p} onAdd={handleAdd} justAdded={justAddedId === p.id} />
            ))}
          </div>
        )}
      </ScrollReveal>

    </div>
  );
}

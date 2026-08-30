/**
 * Shop.jsx — Product listing page with search, category filter, and add-to-cart.
 *
 * Fetches all active products from Supabase and displays them in a responsive
 * grid. Includes a search bar, category filter dropdown, skeleton loading
 * states, and an inline toast notification on add-to-cart.
 *
 * Also fetches `gst_percentage` from `app_settings` to conditionally show
 * "Excl. GST & Shipping" or "Excl. Shipping" on product cards.
 *
 * The product card itself lives in `components/ProductCard.jsx` so that Home can
 * reuse it without importing this page.
 *
 * @module pages/Shop
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchProducts } from "../services/products";
import { useCart } from "../context/CartContext";
import { supabase } from "../services/supabase/client";
import useDebounce from "../hooks/useDebounce";
import SEO from "../components/SEO";
import { useToast } from "../context/ToastContext";
import ScrollReveal from "../components/ScrollReveal";
import ProductCard from "../components/ProductCard";


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
  const [gstPercent, setGstPercent] = useState(0);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const [list, settingsRes] = await Promise.all([
        fetchProducts(),
        supabase.from("app_settings").select("value").eq("key", "gst_percentage").maybeSingle(),
      ]);
      setProducts(list);
      setGstPercent(Number(settingsRes?.data?.value?.percentage ?? 0));
    } catch (e) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // ─── Realtime: auto-refresh when admin updates products ───
  useEffect(() => {
    let debounceTimer = null;
    const channel = supabase
      .channel("products-realtime-web")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => loadProducts(), 500);
        }
      )
      .subscribe();
    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [loadProducts]);

  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => { const c = (p.category || "").trim(); if (c) set.add(c); });
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  const active = useMemo(() => {
    let list = products.filter((p) => p.isActive !== false);
    if (category !== "All") list = list.filter((p) => p.category === category);
    const q = debouncedQuery.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));
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

      {/* Filters — Premium glass bar */}
      <div
        className="mb-8 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        style={{
          background: "rgba(255,255,255,0.75)",
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
          border: "1px solid rgba(232,228,222,0.6)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.9)",
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          {/* Search input with integrated icon */}
          <div className="relative group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="h-4 w-4 text-stone-400 group-focus-within:text-[#1e3a5f] transition-colors" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="w-full sm:w-64 rounded-xl border border-[#E8E4DE]/80 bg-white/90 pl-10 pr-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition-all duration-200 focus:border-[#1e3a5f]/40 focus:ring-[3px] focus:ring-[#1e3a5f]/8 focus:bg-white hover:border-stone-300"
              style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)" }}
            />
          </div>

          {/* Category dropdown with integrated icon */}
          <div className="relative group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="h-4 w-4 text-stone-400 group-focus-within:text-[#1e3a5f] transition-colors" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-.553.894l-4 2A1 1 0 017 19v-8.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
              </svg>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="appearance-none rounded-xl border border-[#E8E4DE]/80 bg-white/90 pl-10 pr-10 py-2.5 text-sm text-stone-900 outline-none transition-all duration-200 focus:border-[#1e3a5f]/40 focus:ring-[3px] focus:ring-[#1e3a5f]/8 focus:bg-white hover:border-stone-300 cursor-pointer"
              style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)" }}
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {/* Custom chevron */}
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="h-4 w-4 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        {/* Product count pill */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E4DE]/60 bg-white/80 px-3 py-1.5 self-start sm:self-auto">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#1e3a5f]/50" />
          <span className="text-xs font-medium text-stone-500">
            {active.length} product{active.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>


      {err && (
        <div className="card p-6 mb-6 text-sm text-red-600">{err}</div>
      )}

      {active.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-base font-semibold text-stone-900">No products found</p>
          <p className="mt-1 text-sm text-stone-500">Try a different search or category.</p>
          <button onClick={() => { setCategory("All"); setQuery(""); }} className="btn-ghost mt-5">Reset filters</button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((p) => (
            <ProductCard key={p.id} p={p} onAdd={handleAdd} justAdded={justAddedId === p.id} gstPercent={gstPercent} />
          ))}
        </div>
      )}

    </div>
  );
}

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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchProducts } from "../services/products";
import { useCart } from "../context/CartContext";
import { supabase } from "../services/supabase/client";
import useDebounce from "../hooks/useDebounce";
import SEO from "../components/SEO";
import { useToast } from "../context/ToastContext";
import ScrollReveal from "../components/ScrollReveal";
import ProductCard from "../components/ProductCard";
import { SkeletonGrid } from "../components/Skeleton";

const PAGE_TITLE = "Shop | Core Atoms";
const PAGE_DESCRIPTION =
  "Browse our full range of premium nutraceuticals. Clean labels, lab-tested, COD available across India.";
/** Generic load failure copy — the raw Supabase message stays in the console. */
const LOAD_ERROR_MESSAGE = "We couldn't load the catalogue just now. Please try again.";

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
  const sort = searchParams.get("sort") || "featured";
  const setCategory = (cat) => {
    setSearchParams((prev) => {
      if (cat === "All") prev.delete("category"); else prev.set("category", cat);
      return prev;
    });
  };
  const setSort = (v) => {
    setSearchParams((prev) => {
      if (v === "featured") prev.delete("sort"); else prev.set("sort", v);
      return prev;
    });
  };
  // `replace` so a search doesn't push one history entry per keystroke —
  // typing "collagen" used to need eight back presses to leave the page.
  const setQuery = (q) => {
    setSearchParams((prev) => {
      if (!q.trim()) prev.delete("q"); else prev.set("q", q);
      return prev;
    }, { replace: true });
  };

  // Debounce search for performance
  const debouncedQuery = useDebounce(query, 300);

  const [justAddedId, setJustAddedId] = useState(null);
  const [gstPercent, setGstPercent] = useState(0);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      // Clear first: a failed initial fetch used to leave the red banner up
      // forever, even after the realtime handler refetched successfully.
      setErr("");
      const [list, settingsRes] = await Promise.all([
        fetchProducts(),
        supabase.from("app_settings").select("value").eq("key", "gst_percentage").maybeSingle(),
      ]);
      setProducts(list);
      setGstPercent(Number(settingsRes?.data?.value?.percentage ?? 0));
    } catch (e) {
      console.error("Shop load error:", e);
      setErr(LOAD_ERROR_MESSAGE);
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
    if (q) list = list.filter((p) => p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));

    // "featured" keeps the catalogue order the store was curated in.
    if (sort !== "featured") {
      list = [...list];
      const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
      if (sort === "price-asc") list.sort((a, b) => num(a.price) - num(b.price));
      else if (sort === "price-desc") list.sort((a, b) => num(b.price) - num(a.price));
      else if (sort === "rating") {
        // Rated products first (by average, review count breaking ties),
        // unrated ones keep their curated order at the end.
        list.sort((a, b) =>
          (num(b.avgRating) - num(a.avgRating)) ||
          (num(b.reviewCount) - num(a.reviewCount))
        );
      }
      else if (sort === "newest") {
        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      }
    }
    return list;
  }, [products, category, debouncedQuery, sort]);

  /** Ref for button feedback timer. */
  const btnTimerRef = useRef(null);

  /** Cleanup timer on unmount. */
  useEffect(() => {
    return () => clearTimeout(btnTimerRef.current);
  }, []);

  /** Handles adding a product to cart with toast + button feedback.
   *  Memoised so `ProductCard`'s React.memo isn't defeated by a fresh callback
   *  identity on every keystroke in the search box. */
  const handleAdd = useCallback((p) => {
    addItem(p, 1);
    setJustAddedId(p.id);
    showToast(`${p.name} added to cart`, "success");
    clearTimeout(btnTimerRef.current);
    btnTimerRef.current = setTimeout(() => setJustAddedId(null), 1000);
  }, [addItem, showToast]);

  // Loading state still emits <SEO> — a crawler that catches the page mid-load
  // used to find no title or description at all.
  if (loading) return (
    <div className="py-4">
      <SEO title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical="/shop" />
      <SkeletonGrid count={6} />
    </div>
  );

  return (
    <div>
      <SEO title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical="/shop" />

      {/* Page header */}
      <ScrollReveal>
        <div className="mb-8">
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
              id="shop-search"
              type="search"
              aria-label="Search products"
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
              id="shop-category"
              aria-label="Filter by category"
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

          {/* Sort dropdown — mirrors the category control's styling */}
          <div className="relative group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="h-4 w-4 text-stone-400 group-focus-within:text-[#1e3a5f] transition-colors" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 4a1 1 0 000 2h11a1 1 0 100-2H3zM3 8a1 1 0 000 2h7a1 1 0 100-2H3zM3 12a1 1 0 100 2h4a1 1 0 100-2H3zM13 16a1 1 0 102 0v-5.586l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 101.414 1.414L13 10.414V16z" />
              </svg>
            </div>
            <select
              id="shop-sort"
              aria-label="Sort products"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="appearance-none rounded-xl border border-[#E8E4DE]/80 bg-white/90 pl-10 pr-10 py-2.5 text-sm text-stone-900 outline-none transition-all duration-200 focus:border-[#1e3a5f]/40 focus:ring-[3px] focus:ring-[#1e3a5f]/8 focus:bg-white hover:border-stone-300 cursor-pointer"
              style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)" }}
            >
              <option value="featured">Sort: Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Top Rated</option>
              <option value="newest">Newest First</option>
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
        <div className="card p-6 mb-6 text-sm text-red-600" role="alert">{err}</div>
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

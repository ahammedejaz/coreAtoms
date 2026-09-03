/**
 * Shop.jsx — Product listing page with a 1mg-style filter rail.
 *
 * Search (`q`) is owned by the header (`components/Navbar.jsx`) — this page
 * only reads it from the URL and shows it as a removable chip. The left rail
 * (desktop) / bottom sheet (mobile) filters on category, price band, customer
 * rating, offers and stock — all URL-synced via `utils/shopFilters.js` so
 * links from Home and the header's category row work without extra state.
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
import SEO from "../components/SEO";
import { useToast } from "../context/ToastContext";
import ScrollReveal from "../components/ScrollReveal";
import ProductCard from "../components/ProductCard";
import ShopFilters from "../components/ShopFilters";
import { SkeletonGrid } from "../components/Skeleton";
import {
  FILTER_KEYS,
  PRICE_BANDS,
  RATING_OPTIONS,
  applyFilters,
  countActiveFilters,
  readFilters,
} from "../utils/shopFilters";

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
  const [sheetOpen, setSheetOpen] = useState(false);

  // URL-synced — survive refresh and are shareable. `q` is owned by the header.
  const query = searchParams.get("q") || "";
  const sort = searchParams.get("sort") || "featured";
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);

  const setFilter = (key, value) => {
    setSearchParams((prev) => {
      const v = value === true ? "1" : value;
      if (!v || v === "All") prev.delete(key); else prev.set(key, String(v));
      return prev;
    });
  };
  const setSort = (v) => {
    setSearchParams((prev) => {
      if (v === "featured") prev.delete("sort"); else prev.set("sort", v);
      return prev;
    });
  };
  const clearFilters = () => {
    setSearchParams((prev) => {
      [...FILTER_KEYS, "q"].forEach((k) => prev.delete(k));
      return prev;
    });
  };
  const removeChip = (key) => {
    if (key === "q") {
      setSearchParams((prev) => { prev.delete("q"); return prev; });
    } else if (key === "offer" || key === "stock") {
      setFilter(key, false);
    } else {
      setFilter(key, "");
    }
  };

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

  // Escape closes the mobile filter sheet.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && sheetOpen) setSheetOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    document.body.style.overflow = sheetOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sheetOpen]);

  const activeProducts = useMemo(() => products.filter((p) => p.isActive !== false), [products]);

  const categories = useMemo(() => {
    const set = new Set();
    activeProducts.forEach((p) => { const c = (p.category || "").trim(); if (c) set.add(c); });
    return Array.from(set).sort();
  }, [activeProducts]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    activeProducts.forEach((p) => {
      const c = (p.category || "").trim();
      if (c) counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  }, [activeProducts]);

  const total = activeProducts.length;

  const active = useMemo(() => {
    let list = applyFilters(products, filters, query);

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
  }, [products, filters, query, sort]);

  const chips = useMemo(() => {
    const list = [];
    if (query) list.push({ key: "q", label: `"${query}"` });
    if (filters.category !== "All") list.push({ key: "category", label: filters.category });
    if (filters.price) {
      const band = PRICE_BANDS.find((b) => b.id === filters.price);
      if (band) list.push({ key: "price", label: band.label });
    }
    if (filters.rating) {
      const option = RATING_OPTIONS.find((r) => r.id === filters.rating);
      if (option) list.push({ key: "rating", label: option.label });
    }
    if (filters.offer) list.push({ key: "offer", label: "On offer" });
    if (filters.stock) list.push({ key: "stock", label: "In stock" });
    return list;
  }, [query, filters]);

  const activeFilterCount = countActiveFilters(filters);

  /** Ref for button feedback timer. */
  const btnTimerRef = useRef(null);

  /** Cleanup timer on unmount. */
  useEffect(() => {
    return () => clearTimeout(btnTimerRef.current);
  }, []);

  /** Handles adding a product to cart with toast + button feedback.
   *  Memoised so `ProductCard`'s React.memo isn't defeated by a fresh callback
   *  identity on every render. */
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

      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 lg:items-start">
        {/* Desktop rail */}
        <div className="hidden lg:block lg:sticky lg:top-28">
          <ShopFilters
            idPrefix="rail"
            categories={categories}
            categoryCounts={categoryCounts}
            total={total}
            filters={filters}
            onChange={setFilter}
            onClear={clearFilters}
          />
        </div>

        <div>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="lg:hidden inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-stone-700"
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E4DE]/60 bg-white/80 px-3 py-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#1e3a5f]/50" />
              <span className="text-xs font-medium text-stone-500">
                {active.length} product{active.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Sort dropdown */}
            <div className="relative group ml-auto">
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
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="h-4 w-4 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          {/* Active filter chips */}
          {(query || activeFilterCount > 0) && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => removeChip(chip.key)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-stone-600 hover:border-stone-300"
                >
                  {chip.label}
                  <span aria-hidden="true" className="text-stone-400">×</span>
                </button>
              ))}
              <button type="button" onClick={clearFilters} className="text-xs font-semibold text-brand hover:underline">
                Clear all
              </button>
            </div>
          )}

          {err && (
            <div className="card p-6 mb-6 text-sm text-red-600" role="alert">{err}</div>
          )}

          {active.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-base font-semibold text-stone-900">No products match these filters.</p>
              <button onClick={clearFilters} className="btn-ghost mt-5">Clear all filters</button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((p) => (
                <ProductCard key={p.id} p={p} onAdd={handleAdd} justAdded={justAddedId === p.id} gstPercent={gstPercent} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSheetOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-5"
          >
            <ShopFilters
              idPrefix="sheet"
              categories={categories}
              categoryCounts={categoryCounts}
              total={total}
              filters={filters}
              onChange={setFilter}
              onClear={clearFilters}
            />
            <button type="button" onClick={() => setSheetOpen(false)} className="btn-primary mt-5 w-full">
              Show {active.length} products
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

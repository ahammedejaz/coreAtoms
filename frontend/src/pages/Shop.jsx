/**
 * Shop.jsx — Product listing page with a 1mg-style filter rail.
 *
 * Search (`q`) is owned by the header (`components/Navbar.jsx`) — this page
 * only reads it from the URL and shows it as a removable chip. The left rail
 * (desktop) / bottom sheet (mobile) filters on category, price band, customer
 * rating, offers and stock — all URL-synced via `utils/shopFilters.js` so
 * links from Home and the header's category row work without extra state.
 * Phones also get a scrollable category chip row above the grid.
 *
 * Also fetches `gst_percentage` from `app_settings` so cards can note
 * "excl. GST" only when it applies. Adding to cart opens the cart drawer.
 * The grid enters with a short stagger and re-sorts in place when a filter
 * or sort changes (Motion `layout` with `AnimatePresence`).
 *
 * @module pages/Shop
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, ChevronDown, SearchX, X } from "lucide-react";
import { fetchProducts } from "../services/products";
import { useCart } from "../context/CartContext";
import { supabase } from "../services/supabase/client";
import SEO from "../components/SEO";
import ProductCard from "../components/ProductCard";
import ShopFilters from "../components/ShopFilters";
import { SkeletonGrid } from "../components/Skeleton";
import { useScrollLock } from "../components/fx/SmoothScroll";
import RevealText from "../components/fx/RevealText";
import { useSiteContent } from "../services/siteContent";
import { AnimatePresence, motion } from "motion/react";
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

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest first" },
];

export default function Shop() {
  const { addItem } = useCart();
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

  // Freeze the page behind the open sheet (through Lenis when it runs).
  useScrollLock(sheetOpen);

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
    if (sort !== "featured") {
      list = [...list];
      const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
      if (sort === "price-asc") list.sort((a, b) => num(a.price) - num(b.price));
      else if (sort === "price-desc") list.sort((a, b) => num(b.price) - num(a.price));
      else if (sort === "rating") {
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

  const btnTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(btnTimerRef.current), []);

  /** Adds with button feedback; the cart drawer is the confirmation. Memoised
   *  so `ProductCard`'s React.memo isn't defeated by a fresh callback. */
  const handleAdd = useCallback((p) => {
    addItem(p, 1);
    setJustAddedId(p.id);
    clearTimeout(btnTimerRef.current);
    btnTimerRef.current = setTimeout(() => setJustAddedId(null), 1000);
  }, [addItem]);

  const shopCopy = useSiteContent("page_shop");
  const heading = filters.category !== "All" ? filters.category : query ? `Results for "${query}"` : shopCopy.title;
  const countLabel = `${active.length} formula${active.length !== 1 ? "s" : ""}`;

  const sortSelect = (
    <div className="relative">
      <label htmlFor="shop-sort" className="sr-only">Sort products</label>
      <select
        id="shop-sort"
        value={sort}
        onChange={(e) => setSort(e.target.value)}
        className="h-10 cursor-pointer appearance-none rounded-full border border-line-strong bg-white pl-4 pr-10 text-[13.5px] font-medium text-ink outline-none transition-[border-color,box-shadow] duration-150 hover:border-ink focus:border-brand focus:shadow-[0_0_0_4px_rgba(30,58,95,0.08)]"
      >
        {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" strokeWidth={1.75} aria-hidden="true" />
    </div>
  );

  return (
    <div>
      <SEO title={PAGE_TITLE} description={PAGE_DESCRIPTION} canonical="/shop" />

      {/* Page header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <RevealText as="h1" key={heading} text={heading} step={40} className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl" />
          <p className="mt-2 text-sm text-stone-500 tabular-nums">{loading ? "Loading the range" : countLabel}</p>
        </div>
        <div className="hidden lg:block">{sortSelect}</div>
      </div>

      {/* Phone category chips */}
      {!loading && categories.length > 0 && (
        <div className="-mx-5 mb-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 scroll-px-5 no-scrollbar lg:hidden sm:-mx-6 sm:px-6 sm:scroll-px-6">
          <button
            type="button"
            onClick={() => setFilter("category", "All")}
            className={`shrink-0 snap-start rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${filters.category === "All" ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-stone-700"}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter("category", c)}
              className={`shrink-0 snap-start rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${filters.category === c ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-stone-700"}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:items-start lg:gap-12">
        {/* Desktop rail */}
        <div className="hidden lg:sticky lg:top-32 lg:block">
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
          {/* Toolbar (phones and tablets) */}
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <button type="button" onClick={() => setSheetOpen(true)} className="btn-secondary btn-sm">
              <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-semibold text-white tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <div className="ml-auto">{sortSelect}</div>
          </div>

          {/* Active filter chips */}
          {(query || activeFilterCount > 0) && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => removeChip(chip.key)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-150 hover:border-ink"
                  aria-label={`Remove filter ${chip.label}`}
                >
                  {chip.label}
                  <X className="h-3 w-3 text-stone-400" strokeWidth={2} aria-hidden="true" />
                </button>
              ))}
              <button type="button" onClick={clearFilters} className="py-1.5 text-xs font-semibold text-brand hover:underline underline-offset-4">
                Clear all
              </button>
            </div>
          )}

          {err && (
            <div className="panel mb-6 p-6 text-sm text-red-700" role="alert">{err}</div>
          )}

          {loading ? (
            <SkeletonGrid count={6} />
          ) : active.length === 0 ? (
            <div className="border-t border-line py-20 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-bone text-brand">
                <SearchX className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <p className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink">{shopCopy.emptyTitle}</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-stone-500">{shopCopy.emptyText}</p>
              <button onClick={clearFilters} className="btn-secondary mt-6">Clear all filters</button>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10">
              <AnimatePresence mode="popLayout">
                {active.map((p, i) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1], delay: Math.min(i, 8) * 0.045 }}
                  >
                    <ProductCard p={p} onAdd={handleAdd} justAdded={justAddedId === p.id} gstPercent={gstPercent} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      {/* Mobile filter sheet — always mounted so the exit can animate. */}
      <div className={`fixed inset-0 z-[60] lg:hidden ${sheetOpen ? "" : "pointer-events-none"}`} inert={!sheetOpen}>
        <div
          aria-hidden="true"
          onClick={() => setSheetOpen(false)}
          className={`absolute inset-0 bg-navy-950/45 transition-opacity ${sheetOpen ? "duration-300 opacity-100" : "duration-200 opacity-0"}`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
          data-lenis-prevent
          className={`absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[28px] bg-white px-5 pb-6 pt-3 shadow-lift-lg transition-transform ease-drawer ${sheetOpen ? "duration-[420ms] translate-y-0" : "duration-[260ms] translate-y-full"}`}
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          <div aria-hidden="true" className="mx-auto mb-5 h-1 w-10 rounded-full bg-line-strong" />
          <ShopFilters
            idPrefix="sheet"
            categories={categories}
            categoryCounts={categoryCounts}
            total={total}
            filters={filters}
            onChange={setFilter}
            onClear={clearFilters}
          />
          <button type="button" onClick={() => setSheetOpen(false)} className="btn-primary btn-lg mt-6 w-full">
            Show {active.length} formula{active.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Home.jsx — Admin-customisable marketing landing page.
 *
 * Fetches the following from `app_settings` on mount (parallel requests):
 *   homepage_hero_images, homepage_hero_copy, homepage_pillars,
 *   homepage_categories, homepage_philosophy, homepage_featured_products,
 *   gst_percentage (to conditionally show 'Excl. GST & Shipping' on cards)
 *
 * All visible text, images, and links are admin-controlled via AdminHomepage.
 * The hero carousel auto-advances with a 5 s interval.
 * Featured products strip reuses the shared `ProductCard` component.
 *
 * @module pages/Home
 */
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchProducts } from "../services/products";
import { supabase } from "../services/supabase/client";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import { SkeletonGrid } from "../components/Skeleton";
import { useToast } from "../context/ToastContext";
import ScrollReveal from "../components/ScrollReveal";
import PromoBanner from "../components/PromoBanner";

// ── Defaults (shown if admin hasn't saved yet) ────────────────────────────────
const DEFAULT_HERO_IMAGES = [
  "/hero/hero-1.jpg", "/hero/hero-2.jpg", "/hero/hero-3.jpg", "/hero/hero-4.jpg",
];

const DEFAULT_HERO_COPY = {
  headline: "Engineered for",
  headlineAccent: "daily consistency.",
  body: "Modern nutraceuticals designed for real routines. Clean formulas, structured stacks, and a premium experience from checkout to delivery.",
  primaryCta: "Shop all products",
  secondaryCta: "View best sellers",
  trustIcons: [
    { icon: "🧪", label: "Clean labels" },
    { icon: "🚚", label: "COD available" },
    { icon: "📦", label: "Pan-India delivery" },
  ],
};

const DEFAULT_PILLARS = [
  { icon: "✦", title: "Clean Labels", desc: "No fillers, no hidden ingredients. Every formula is fully disclosed." },
  { icon: "◈", title: "Lab Tested", desc: "Third-party verified for potency, purity, and safety." },
  { icon: "⬡", title: "COD Available", desc: "Cash on delivery across India. No prepayment required." },
  { icon: "⌖", title: "Fast Fulfilment", desc: "Orders dispatched within 24 hours from our facility." },
];

const DEFAULT_CATEGORIES = [
  { label: "Multivitamins", emoji: "💊", category: "General Wellness" },
  { label: "Joint Support", emoji: "🦴", category: "Joint Support" },
  { label: "Bone Health", emoji: "🧬", category: "Bone Health" },
  { label: "Hair & Skin", emoji: "✨", category: "HSN" },
  { label: "Gut Health", emoji: "🌿", category: "Gut Health" },
  { label: "Collagen", emoji: "🔬", category: "Collagen" },
];

const DEFAULT_PHILOSOPHY = {
  label: "Our Philosophy",
  heading: "Built like a system,\nnot a trend.",
  body: "Each Core Atoms formulation is designed around consistency — functional ingredients, simplified stacks, and structured support for real-world routines. No inflated claims. No unnecessary fillers. Just premium precision and daily reliability.",
  cta: "Explore the range",
};

export default function Home() {
  const { addItem } = useCart();
  const { showToast } = useToast();

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [justAddedId, setJustAddedId] = useState(null);

  // Settings state
  const [heroReady, setHeroReady] = useState(false);
  const [heroImages, setHeroImages] = useState(
    DEFAULT_HERO_IMAGES.map((url) => ({ url, position: "50% 50%" }))
  );
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroCopy, setHeroCopy] = useState(DEFAULT_HERO_COPY);
  const [pillars, setPillars] = useState(DEFAULT_PILLARS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [philosophy, setPhilosophy] = useState(DEFAULT_PHILOSOPHY);
  const [gstPercent, setGstPercent] = useState(0);

  // ── Load all settings + products in parallel ─────────────────────────────
  const loadData = useCallback(async () => {
    setLoadingProducts(true);
    setFetchError("");
    try {
      const [settingsRes, productList] = await Promise.all([
        supabase
          .from("app_settings")
          .select("key,value")
          .in("key", [
            "homepage_hero_images",
            "homepage_hero_copy",
            "homepage_featured_products",
            "homepage_pillars",
            "homepage_categories",
            "homepage_philosophy",
            "gst_percentage",
          ]),
        fetchProducts(),
      ]);

      const map = {};
      (settingsRes.data || []).forEach((row) => { map[row.key] = row.value; });

      // Hero images — support old string[] and new {url,position}[]
      const rawImgs = Array.isArray(map.homepage_hero_images) && map.homepage_hero_images.length > 0
        ? map.homepage_hero_images : DEFAULT_HERO_IMAGES;
      setHeroImages(rawImgs.map((item) =>
        typeof item === "string"
          ? { url: item, position: "50% 50%" }
          : { url: item.url || "", position: item.position || "50% 50%" }
      ));

      // Hero copy
      if (map.homepage_hero_copy && typeof map.homepage_hero_copy === "object") {
        setHeroCopy({ ...DEFAULT_HERO_COPY, ...map.homepage_hero_copy });
      }

      // Pillars
      if (Array.isArray(map.homepage_pillars) && map.homepage_pillars.length > 0) {
        setPillars(map.homepage_pillars);
      }

      // Categories
      if (Array.isArray(map.homepage_categories) && map.homepage_categories.length > 0) {
        setCategories(map.homepage_categories);
      }

      // Philosophy
      if (map.homepage_philosophy && typeof map.homepage_philosophy === "object") {
        setPhilosophy({ ...DEFAULT_PHILOSOPHY, ...map.homepage_philosophy });
      }

      // GST
      setGstPercent(Number(map.gst_percentage?.percentage ?? 0));

      // Featured products
      const featuredIds = Array.isArray(map.homepage_featured_products)
        ? map.homepage_featured_products : [];
      if (featuredIds.length > 0) {
        const pinned = featuredIds.map((id) => productList.find((p) => p.id === id)).filter(Boolean);
        setProducts(pinned.length > 0 ? pinned : productList.slice(0, 6));
      } else {
        setProducts(productList.slice(0, 6));
      }
    } catch (e) {
      console.error("Home load error:", e);
      setFetchError(e?.message || "Failed to load products. Please try again.");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Realtime: auto-refresh when admin updates products ───
  useEffect(() => {
    let debounceTimer = null;
    let channel = null;
    try {
      channel = supabase
        .channel("products-realtime-home")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "products" },
          () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => loadData(), 500);
          }
        )
        .subscribe();
    } catch (e) {
      console.error("Realtime subscription error:", e);
    }
    return () => {
      clearTimeout(debounceTimer);
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* ignore cleanup errors */ }
      }
    };
  }, [loadData]);

  // Preload hero images into browser cache so carousel transitions are instant
  useEffect(() => {
    if (!heroImages.length) return;
    heroImages.forEach((slide) => {
      const img = new window.Image();
      img.src = slide.url;
    });
  }, [heroImages]);

  // Carousel auto-advance
  useEffect(() => {
    if (heroImages.length <= 1) return;
    const t = setInterval(() => setHeroIndex((i) => (i + 1) % heroImages.length), 3500);
    return () => clearInterval(t);
  }, [heroImages]);

  // Reset carousel index when images change; clamp to valid range if images shrink
  useEffect(() => {
    if (heroImages.length === 0) return;
    setHeroIndex((i) => (i >= heroImages.length ? 0 : i));
  }, [heroImages]);

  /** Ref for button feedback timer (avoid polluting `window`). */
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
    btnTimerRef.current = setTimeout(() => setJustAddedId(null), 900);
  };

  const trust = heroCopy.trustIcons || DEFAULT_HERO_COPY.trustIcons;

  return (
    <div className="space-y-24">
      <SEO
        title="Core Atoms | Nutraceuticals"
        description="Modern nutraceuticals designed for real routines. Clean formulas, structured stacks, COD available across India."
      />

      {/* ── PROMO BANNER (admin-controlled) ─────────────────────────────── */}
      <PromoBanner />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="rounded-3xl bg-white overflow-hidden relative" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06), 0 12px 48px rgba(30,58,95,0.08), inset 0 1px 0 rgba(255,255,255,0.9)', border: '1px solid rgba(232,228,222,0.5)' }}>
        {/* Subtle gradient mesh overlay */}
        <div className="absolute inset-0 pointer-events-none z-0 opacity-30" style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(30,58,95,0.06), transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(30,58,95,0.04), transparent 50%)' }} />
        <div className="grid lg:grid-cols-2 gap-0">

          {/* LEFT — carousel: aspect-ratio on mobile, stretch to full card height on desktop */}
          <div className="relative overflow-hidden aspect-[4/3] lg:aspect-auto">
            {/* Shimmer skeleton — visible until first hero image loads */}
            <div
              className={`absolute inset-0 bg-stone-100 transition-opacity duration-500 ${heroReady ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
              style={{ zIndex: 5 }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.5s infinite",
                }}
              />
            </div>

            <div className="absolute inset-0">
              {heroImages.map((slide, i) => (
                <div
                  key={i}
                  className="absolute inset-0 transition-opacity duration-700"
                  style={{ opacity: i === heroIndex ? 1 : 0, zIndex: i === heroIndex ? 1 : 0 }}
                >
                  <img
                    src={slide.url}
                    alt={`Hero ${i + 1}`}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ objectPosition: slide.position || "50% 50%" }}
                    loading="eager"
                    fetchPriority={i === 0 ? "high" : "auto"}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    onLoad={i === 0 ? () => setHeroReady(true) : undefined}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-transparent" />
                </div>
              ))}
            </div>

            {/* Dots */}
            <div className="absolute bottom-5 left-6 flex gap-2" style={{ zIndex: 10 }}>
              {heroImages.map((_, i) => (
                <button key={i} type="button" onClick={() => setHeroIndex(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${i === heroIndex ? "w-6 bg-white shadow" : "w-2 bg-white/50"}`} />
              ))}
            </div>

            {/* Arrows */}
            {heroImages.length > 1 && (
              <div style={{ zIndex: 10 }} className="contents">
                <button type="button"
                  onClick={() => setHeroIndex((heroIndex - 1 + heroImages.length) % heroImages.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/80 backdrop-blur-sm border border-white/60 shadow flex items-center justify-center text-stone-700 hover:bg-white transition"
                  style={{ zIndex: 10 }}>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 16l-6-6 6-6" /></svg>
                </button>
                <button type="button"
                  onClick={() => setHeroIndex((heroIndex + 1) % heroImages.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/80 backdrop-blur-sm border border-white/60 shadow flex items-center justify-center text-stone-700 hover:bg-white transition"
                  style={{ zIndex: 10 }}>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 4l6 6-6 6" /></svg>
                </button>
              </div>
            )}
          </div>

          {/* RIGHT — copy */}
          <div className="flex flex-col justify-center px-10 py-12 lg:px-14 lg:py-16">
            <div className="section-label mb-4">Core Atoms — Nutraceuticals</div>
            <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight text-stone-900 leading-[1.12]">
              {heroCopy.headline}<br />
              <span className="text-[#1e3a5f]">{heroCopy.headlineAccent}</span>
            </h1>
            <p className="mt-6 text-[15px] text-stone-500 leading-relaxed max-w-sm">{heroCopy.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/shop" className="btn-primary px-6 py-3 text-[14px]">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 13.846 4.632 15 6.414 15H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 5H6.28l-.31-1.243A1 1 0 005 3H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg>
                {heroCopy.primaryCta || "Shop all products"}
              </Link>
              <Link to="/shop" className="btn-ghost px-6 py-3 text-[14px]">
                {heroCopy.secondaryCta || "View best sellers"} →
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-3 pt-8" style={{ borderTop: '1px solid rgba(232,228,222,0.5)' }}>
              {trust.slice(0, 3).map((t) => (
                <div key={t.label} className="text-center group">
                  <div className="text-xl mb-1 group-hover:scale-110 transition-transform duration-300">{t.icon}</div>
                  <div className="text-[11px] font-medium text-stone-500">{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PILLARS ───────────────────────────────────────────────────────── */}
      <ScrollReveal>
        <section>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((p, i) => (
              <div key={i} className="card-shine group rounded-2xl bg-white/80 p-6 relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ border: '1px solid rgba(232,228,222,0.6)', boxShadow: '0 2px 8px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.02), inset 0 1px 0 rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06), 0 16px 40px rgba(30,58,95,0.06), inset 0 1px 0 rgba(255,255,255,0.9)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.02), inset 0 1px 0 rgba(255,255,255,0.8)'; }}>
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#EFF6FF] to-[#1e3a5f]/10 flex items-center justify-center text-[#1e3a5f] text-xl mb-4 group-hover:scale-110 transition-transform duration-300" style={{ boxShadow: '0 2px 8px rgba(30,58,95,0.1)' }}>{p.icon}</div>
                <div className="text-sm font-semibold text-stone-900">{p.title}</div>
                <div className="mt-1.5 text-[13px] text-stone-500 leading-relaxed">{p.desc}</div>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* ── FEATURED PRODUCTS ─────────────────────────────────────────────── */}
      <ScrollReveal>
        <section>
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="section-label">Top Picks</p>
              <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-stone-900">Featured Products</h2>
            </div>
            <Link to="/shop" className="text-sm font-semibold text-[#1e3a5f] hover:underline underline-offset-2">View all →</Link>
          </div>
          {loadingProducts ? (
            <SkeletonGrid count={6} />
          ) : fetchError ? (
            <div className="card p-12 text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-red-50 border border-red-200 grid place-items-center">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              </div>
              <p className="font-semibold text-stone-900">Unable to load products</p>
              <p className="mt-1 text-sm text-stone-500">{fetchError}</p>
              <button type="button" onClick={loadData} className="btn-primary mt-5 inline-flex">Try again</button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} p={p} onAdd={handleAdd} justAdded={justAddedId === p.id} gstPercent={gstPercent} />
              ))}
            </div>
          )}
        </section>
      </ScrollReveal>

      {/* ── SHOP BY CATEGORY ──────────────────────────────────────────────── */}
      <ScrollReveal>
        < section >
          <div className="text-center mb-10">
            <p className="section-label">Browse by Goal</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">Shop by Category</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((cat, i) => (
              <div key={i} style={{ perspective: '600px' }}>
                <Link to={`/shop?category=${encodeURIComponent(cat.category)}`}
                  className="group flex flex-col items-center gap-3 rounded-2xl bg-white/80 p-5 text-center transition-all duration-500"
                  style={{ border: '1px solid rgba(232,228,222,0.5)', boxShadow: '0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', transformStyle: 'preserve-3d' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'rotateY(8deg) translateY(-4px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(30,58,95,0.08), 0 0 0 1px rgba(30,58,95,0.08)'; e.currentTarget.style.borderColor = 'rgba(30,58,95,0.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'rotateY(0deg) translateY(0px)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.8)'; e.currentTarget.style.borderColor = 'rgba(232,228,222,0.5)'; }}>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#EFF6FF] to-[#1e3a5f]/8 flex items-center justify-center text-2xl group-hover:scale-110 group-hover:shadow-[0_4px_12px_rgba(30,58,95,0.12)] transition-all duration-300">{cat.emoji}</div>
                  <span className="text-[12px] font-semibold text-stone-700 group-hover:text-[#1e3a5f] leading-snug transition-colors">{cat.label}</span>
                </Link>
              </div>
            ))}
          </div>
        </section >
      </ScrollReveal>

      {/* ── PHILOSOPHY ────────────────────────────────────────────────────── */}
      <ScrollReveal variant="scale">
        < section className="rounded-3xl bg-white p-12 lg:p-16 text-center relative overflow-hidden" style={{ border: '1px solid rgba(232,228,222,0.5)', boxShadow: '0 4px 20px rgba(0,0,0,0.04), 0 12px 48px rgba(30,58,95,0.06), inset 0 1px 0 rgba(255,255,255,0.9)' }}>
          {/* Mesh background */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 30% 0%, rgba(30,58,95,0.04), transparent 50%), radial-gradient(ellipse at 70% 100%, rgba(30,58,95,0.03), transparent 50%)' }} />
          <div className="mx-auto max-w-2xl">
            <p className="section-label mb-4">{philosophy.label || "Our Philosophy"}</p>
            <h2 className="text-2xl lg:text-3xl font-semibold tracking-tight text-stone-900 leading-snug whitespace-pre-line">
              {philosophy.heading || DEFAULT_PHILOSOPHY.heading}
            </h2>
            <p className="mt-5 text-[15px] text-stone-500 leading-relaxed">
              {philosophy.body || DEFAULT_PHILOSOPHY.body}
            </p>
            <Link to="/shop" className="btn-primary mt-8 inline-flex px-8 py-3">
              {philosophy.cta || "Explore the range"}
            </Link>
          </div>
        </section >
      </ScrollReveal>


    </div >
  );
}

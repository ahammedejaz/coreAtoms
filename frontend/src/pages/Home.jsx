import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useEffect, useState } from "react";
import { fetchProducts } from "../services/products";
import { supabase } from "../services/supabase/client";
import { ProductCard } from "./Shop";

const DEFAULT_HERO_IMAGES = [
  "/hero/hero-1.jpg",
  "/hero/hero-2.jpg",
  "/hero/hero-3.jpg",
  "/hero/hero-4.jpg",
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

const PILLARS = [
  { icon: "✦", title: "Clean Labels",    desc: "No fillers, no hidden ingredients. Every formula is fully disclosed." },
  { icon: "◈", title: "Lab Tested",      desc: "Third-party verified for potency, purity, and safety." },
  { icon: "⬡", title: "COD Available",   desc: "Cash on delivery across India. No prepayment required." },
  { icon: "⌖", title: "Fast Fulfilment", desc: "Orders dispatched within 24 hours from our facility." },
];

const CATEGORIES = [
  { label: "Multivitamins", emoji: "💊", category: "General Wellness" },
  { label: "Joint Support",  emoji: "🦴", category: "Joint Support" },
  { label: "Bone Health",    emoji: "🧬", category: "Bone Health" },
  { label: "Hair & Skin",    emoji: "✨", category: "HSN" },
  { label: "Gut Health",     emoji: "🌿", category: "Gut Health" },
  { label: "Collagen",       emoji: "🔬", category: "Collagen" },
];

export default function Home() {
  const { addItem } = useCart();

  const [products, setProducts]               = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [toast, setToast]                     = useState({ open: false, message: "" });
  const [justAddedId, setJustAddedId]         = useState(null);

  const [heroImages, setHeroImages] = useState(DEFAULT_HERO_IMAGES);
  const [heroCopy, setHeroCopy]     = useState(DEFAULT_HERO_COPY);
  const [heroIndex, setHeroIndex]   = useState(0);

  // ── Single coordinated load: settings + products together ────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fetch settings and products in parallel
        const [settingsRes, productList] = await Promise.all([
          supabase
            .from("app_settings")
            .select("key,value")
            .in("key", ["homepage_hero_images", "homepage_hero_copy", "homepage_featured_products"]),
          fetchProducts(),
        ]);

        if (cancelled) return;

        // ── Apply settings ────────────────────────────────────────────────
        const map = {};
        (settingsRes.data || []).forEach((row) => { map[row.key] = row.value; });

        // Hero images
        const imgs = Array.isArray(map.homepage_hero_images) && map.homepage_hero_images.length > 0
          ? map.homepage_hero_images
          : DEFAULT_HERO_IMAGES;
        setHeroImages(imgs);

        // Hero copy
        if (map.homepage_hero_copy && typeof map.homepage_hero_copy === "object") {
          setHeroCopy({ ...DEFAULT_HERO_COPY, ...map.homepage_hero_copy });
        }

        // ── Apply featured products ───────────────────────────────────────
        const featuredIds = Array.isArray(map.homepage_featured_products)
          ? map.homepage_featured_products
          : [];

        if (featuredIds.length > 0) {
          const pinned = featuredIds
            .map((id) => productList.find((p) => p.id === id))
            .filter(Boolean);
          setProducts(pinned.length > 0 ? pinned : productList.slice(0, 6));
        } else {
          setProducts(productList.slice(0, 6));
        }
      } catch (e) {
        console.error("Home load error:", e);
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Hero carousel auto-advance ────────────────────────────────────────────
  useEffect(() => {
    if (heroImages.length <= 1) return;
    const t = setInterval(() => setHeroIndex((i) => (i + 1) % heroImages.length), 3500);
    return () => clearInterval(t);
  }, [heroImages]);

  useEffect(() => { setHeroIndex(0); }, [heroImages]);

  const handleAdd = (p) => {
    addItem(p, 1);
    setJustAddedId(p.id);
    setToast({ open: true, message: `${p.name} added to cart` });
    window.clearTimeout(window.__ca_home_btn);
    window.__ca_home_btn = setTimeout(() => setJustAddedId(null), 900);
    window.clearTimeout(window.__ca_home_toast);
    window.__ca_home_toast = setTimeout(() => setToast({ open: false, message: "" }), 1800);
  };

  const trust = heroCopy.trustIcons || DEFAULT_HERO_COPY.trustIcons;

  return (
    <div className="space-y-24">

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-[#E8E4DE] bg-white overflow-hidden shadow-[0_4px_40px_rgba(0,0,0,0.08)]">
        <div className="grid lg:grid-cols-2 gap-0">

          {/* LEFT — carousel */}
          <div className="relative overflow-hidden h-[340px] lg:h-[500px]">
            <div
              className="flex h-full w-full transition-transform duration-700 ease-out"
              style={{ transform: `translateX(-${heroIndex * 100}%)` }}
            >
              {heroImages.map((src, i) => (
                <div key={i} className="h-full w-full shrink-0 relative">
                  <img src={src} alt={`Hero ${i + 1}`} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-transparent" />
                </div>
              ))}
            </div>

            {/* Dots */}
            <div className="absolute bottom-5 left-6 flex gap-2">
              {heroImages.map((_, i) => (
                <button key={i} type="button" onClick={() => setHeroIndex(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${i === heroIndex ? "w-6 bg-white shadow" : "w-2 bg-white/50"}`} />
              ))}
            </div>

            {/* Arrows */}
            {heroImages.length > 1 && (<>
              <button type="button"
                onClick={() => setHeroIndex((heroIndex - 1 + heroImages.length) % heroImages.length)}
                className="absolute left-4 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/80 backdrop-blur-sm border border-white/60 shadow flex items-center justify-center text-stone-700 hover:bg-white transition">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 16l-6-6 6-6"/></svg>
              </button>
              <button type="button"
                onClick={() => setHeroIndex((heroIndex + 1) % heroImages.length)}
                className="absolute right-4 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/80 backdrop-blur-sm border border-white/60 shadow flex items-center justify-center text-stone-700 hover:bg-white transition">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 4l6 6-6 6"/></svg>
              </button>
            </>)}
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
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 13.846 4.632 15 6.414 15H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 5H6.28l-.31-1.243A1 1 0 005 3H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>
                {heroCopy.primaryCta || "Shop all products"}
              </Link>
              <Link to="/shop" className="btn-ghost px-6 py-3 text-[14px]">
                {heroCopy.secondaryCta || "View best sellers"} →
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-3 border-t border-[#E8E4DE] pt-8">
              {trust.slice(0, 3).map((t) => (
                <div key={t.label} className="text-center">
                  <div className="text-xl mb-1">{t.icon}</div>
                  <div className="text-[11px] font-medium text-stone-500">{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PILLARS ───────────────────────────────────────────────────── */}
      <section>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <div key={p.title} className="group rounded-2xl border border-[#E8E4DE] bg-white p-6 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200">
              <div className="text-[#1e3a5f] text-xl mb-4">{p.icon}</div>
              <div className="text-sm font-semibold text-stone-900">{p.title}</div>
              <div className="mt-1.5 text-[13px] text-stone-500 leading-relaxed">{p.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURED PRODUCTS ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="section-label">Top Picks</p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-stone-900">Featured Products</h2>
          </div>
          <Link to="/shop" className="text-sm font-semibold text-[#1e3a5f] hover:underline underline-offset-2">View all →</Link>
        </div>

        {loadingProducts ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-[#E8E4DE] bg-white overflow-hidden animate-pulse">
                <div className="h-[220px] bg-stone-100" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-stone-100 rounded w-3/4" />
                  <div className="h-3 bg-stone-100 rounded w-full" />
                  <div className="h-10 bg-stone-100 rounded-xl mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} onAdd={handleAdd} justAdded={justAddedId === p.id} />
            ))}
          </div>
        )}
      </section>

      {/* ── CATEGORY STRIP ────────────────────────────────────────────── */}
      <section>
        <div className="text-center mb-10">
          <p className="section-label">Browse by Goal</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">Shop by Category</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((cat) => (
            <Link key={cat.category} to={`/shop?category=${encodeURIComponent(cat.category)}`}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-[#E8E4DE] bg-white p-5 text-center hover:border-[#1e3a5f]/30 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200">
              <div className="h-12 w-12 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-2xl group-hover:bg-[#1e3a5f]/10 transition-colors">{cat.emoji}</div>
              <span className="text-[12px] font-semibold text-stone-700 group-hover:text-[#1e3a5f] leading-snug transition-colors">{cat.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── BRAND STATEMENT ───────────────────────────────────────────── */}
      <section className="rounded-3xl border border-[#E8E4DE] bg-white p-12 lg:p-16 text-center">
        <div className="mx-auto max-w-2xl">
          <p className="section-label mb-4">Our Philosophy</p>
          <h2 className="text-2xl lg:text-3xl font-semibold tracking-tight text-stone-900 leading-snug">
            Built like a system,<br className="hidden sm:block" /> not a trend.
          </h2>
          <p className="mt-5 text-[15px] text-stone-500 leading-relaxed">
            Each Core Atoms formulation is designed around consistency — functional ingredients,
            simplified stacks, and structured support for real-world routines. No inflated claims.
            No unnecessary fillers. Just premium precision and daily reliability.
          </p>
          <Link to="/shop" className="btn-primary mt-8 inline-flex px-8 py-3">Explore the range</Link>
        </div>
      </section>

      {/* ── TOAST ─────────────────────────────────────────────────────── */}
      <div className={`fixed bottom-6 right-6 z-50 card px-5 py-3.5 transition-all duration-300 ${
        toast.open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      }`}>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 grid place-items-center">
            <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd"/></svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-stone-900">Added to cart</div>
            <div className="text-xs text-stone-500">{toast.message}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

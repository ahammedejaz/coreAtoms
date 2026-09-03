/**
 * Home.jsx — Admin-customisable brand landing page.
 *
 * Rendered full-bleed (see `handle.fullBleed` on the index route and
 * `layouts/MainLayout.jsx`), unlike every other page which sits in a centred
 * `max-w-6xl` container.
 *
 * Fetches the following from `app_settings` on mount (parallel requests):
 *   homepage_hero_images, homepage_hero_copy, homepage_pillars,
 *   homepage_categories, homepage_philosophy, homepage_featured_products,
 *   homepage_why_us, gst_percentage (to conditionally show 'Excl. GST &
 *   Shipping' on cards). Testimonials are read separately from
 *   `product_reviews` (rating >= 4, non-empty body) via
 *   `services/homepage.fetchHomepageReviews()`, which never throws.
 *
 * All visible text, images, and links are admin-controlled via AdminHomepage.
 * The hero carousel auto-advances every 3.5 s; when no hero images are
 * configured (or every configured URL is dead) it falls back to a branded
 * gradient panel rather than a permanent shimmer.
 *
 * Section order: hero, trust strip, shop by need, best sellers, why-us proof
 * band, testimonials (hidden when there are none), philosophy.
 *
 * @module pages/Home
 */
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchProducts } from "../services/products";
import { supabase } from "../services/supabase/client";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import { SkeletonGrid } from "../components/Skeleton";
import { useToast } from "../context/ToastContext";
import ScrollReveal from "../components/ScrollReveal";
import PromoBanner from "../components/PromoBanner";
import Testimonials from "../components/Testimonials";
import { DEFAULT_HOME_CATEGORIES, DEFAULT_WHY_US, fetchHomepageReviews } from "../services/homepage";

// ── Defaults (shown if admin hasn't saved yet) ────────────────────────────────
/** Hero auto-advance interval, ms. */
const HERO_INTERVAL_MS = 3500;

/** Generic load failure copy — the raw Supabase message stays in the console. */
const LOAD_ERROR_MESSAGE = "We couldn't load products just now. Please try again.";

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

const DEFAULT_PHILOSOPHY = {
  label: "Our Philosophy",
  heading: "Built like a system,\nnot a trend.",
  body: "Each Core Atoms formulation is designed around consistency — functional ingredients, simplified stacks, and structured support for real-world routines. No inflated claims. No unnecessary fillers. Just premium precision and daily reliability.",
  cta: "Explore the range",
};

/** Centres and pads section content to match the rest of the site's container width. */
function Container({ children, className = "" }) {
  return <div className={`mx-auto max-w-6xl px-6 ${className}`}>{children}</div>;
}

export default function Home() {
  const { addItem } = useCart();
  const { showToast } = useToast();

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [justAddedId, setJustAddedId] = useState(null);

  // Settings state
  const [heroReady, setHeroReady] = useState(false);
  /** `null` until `app_settings` resolves, so the shimmer isn't replaced by the
   *  branded fallback for a frame before real hero images arrive. */
  const [heroImages, setHeroImages] = useState(null);
  /** URLs the browser could not load — hidden so a 404 never sits in the deck. */
  const [brokenSlides, setBrokenSlides] = useState({});
  const [heroIndex, setHeroIndex] = useState(0);
  /** Bumped on manual navigation to restart the auto-advance interval. */
  const [heroTick, setHeroTick] = useState(0);
  const [heroCopy, setHeroCopy] = useState(DEFAULT_HERO_COPY);
  const [pillars, setPillars] = useState(DEFAULT_PILLARS);
  const [categories, setCategories] = useState(DEFAULT_HOME_CATEGORIES);
  const [philosophy, setPhilosophy] = useState(DEFAULT_PHILOSOPHY);
  const [whyUs, setWhyUs] = useState(DEFAULT_WHY_US);
  const [reviews, setReviews] = useState([]);
  const [gstPercent, setGstPercent] = useState(0);

  // ── Load all settings + products in parallel ─────────────────────────────
  const loadData = useCallback(async () => {
    setLoadingProducts(true);
    setFetchError("");
    try {
      const [settingsRes, productList, reviewList] = await Promise.all([
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
            "homepage_why_us",
            "gst_percentage",
          ]),
        fetchProducts(),
        // Testimonials must never fail the page.
        fetchHomepageReviews().catch(() => []),
      ]);

      const map = {};
      (settingsRes.data || []).forEach((row) => { map[row.key] = row.value; });

      // Hero images — support old string[] and new {url,position}[].
      // No default list: there are no bundled hero assets to point at, so an
      // unconfigured hero renders the branded gradient instead of 404s.
      const rawImgs = Array.isArray(map.homepage_hero_images) ? map.homepage_hero_images : [];
      setHeroImages(rawImgs.map((item) =>
        typeof item === "string"
          ? { url: item, position: "50% 50%" }
          : { url: item?.url || "", position: item?.position || "50% 50%" }
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

      // Why us
      if (map.homepage_why_us && typeof map.homepage_why_us === "object") {
        setWhyUs({
          ...DEFAULT_WHY_US,
          ...map.homepage_why_us,
          stats: Array.isArray(map.homepage_why_us.stats) && map.homepage_why_us.stats.length > 0
            ? map.homepage_why_us.stats
            : DEFAULT_WHY_US.stats,
        });
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

      setReviews(reviewList);
    } catch (e) {
      console.error("Home load error:", e);
      setHeroImages((prev) => prev ?? []);
      setFetchError(LOAD_ERROR_MESSAGE);
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

  // Slides actually worth rendering. Every slide is already in the DOM with
  // loading="eager", so no separate `new Image()` preload pass is needed.
  const slides = useMemo(
    () => (heroImages || []).filter((s) => s.url && !brokenSlides[s.url]),
    [heroImages, brokenSlides]
  );
  /** Settings haven't resolved yet — keep the shimmer, don't flash the fallback. */
  const heroPending = heroImages === null;

  // Carousel auto-advance. `heroTick` is in the deps so a dot/arrow click
  // restarts the countdown instead of being overridden a moment later.
  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setHeroIndex((i) => (i + 1) % slides.length), HERO_INTERVAL_MS);
    return () => clearInterval(t);
  }, [slides.length, heroTick]);

  // Reset carousel index when images change; clamp to valid range if images shrink
  useEffect(() => {
    if (slides.length === 0) return;
    setHeroIndex((i) => (i >= slides.length ? 0 : i));
  }, [slides.length]);

  /** Manual dot/arrow navigation — also restarts the auto-advance timer. */
  const goToSlide = useCallback((i) => {
    setHeroIndex(i);
    setHeroTick((t) => t + 1);
  }, []);

  /** A slide 404'd: drop it from the deck and release the shimmer regardless. */
  const handleSlideError = useCallback((url) => {
    setBrokenSlides((prev) => ({ ...prev, [url]: true }));
    setHeroReady(true);
  }, []);

  /** Ref for button feedback timer (avoid polluting `window`). */
  const btnTimerRef = useRef(null);

  /** Cleanup timer on unmount. */
  useEffect(() => {
    return () => clearTimeout(btnTimerRef.current);
  }, []);

  /** Handles adding a product to cart with toast + button feedback.
   *  Memoised so `ProductCard`'s React.memo isn't defeated by a fresh
   *  callback identity on every render. */
  const handleAdd = useCallback((p) => {
    addItem(p, 1);
    setJustAddedId(p.id);
    showToast(`${p.name} added to cart`, "success");
    clearTimeout(btnTimerRef.current);
    btnTimerRef.current = setTimeout(() => setJustAddedId(null), 900);
  }, [addItem, showToast]);

  const trust = heroCopy.trustIcons || DEFAULT_HERO_COPY.trustIcons;

  return (
    <div>
      <SEO
        title="Core Atoms | Nutraceuticals"
        description="Modern nutraceuticals designed for real routines. Clean formulas, structured stacks, COD available across India."
        canonical="/"
      />

      {/* ── PROMO BANNER (admin-controlled) ─────────────────────────────── */}
      <PromoBanner />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-line">
        <Container className="grid gap-10 lg:grid-cols-2 lg:items-center py-10 lg:py-16">

          {/* Carousel column — first on mobile so the visual leads */}
          <div
            className="order-first lg:order-none rounded-3xl overflow-hidden aspect-[4/3] relative"
            role="region" aria-roledescription="carousel" aria-label="Featured imagery"
          >
            {/* Shimmer skeleton — only while there is something still to load.
                Released by the first onLoad *or* onError, so a dead URL can no
                longer freeze the hero as a permanent grey block. */}
            {(heroPending || slides.length > 0) && (
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
            )}

            {slides.length > 0 ? (
              <div className="absolute inset-0">
                {slides.map((slide, i) => (
                  <div
                    key={`${i}-${slide.url}`}
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
                      onError={() => handleSlideError(slide.url)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-transparent" />
                  </div>
                ))}
              </div>
            ) : !heroPending && (
              /* Branded fallback — no hero images configured, or every URL is
                 dead. Pure CSS gradient plus the bundled logo, so nothing 404s. */
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2f5c8f 55%, #1e3a5f 100%)" }}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: "radial-gradient(ellipse at 30% 25%, rgba(255,255,255,0.16), transparent 55%)" }}
                />
                <img
                  src="/logo.png"
                  alt="Core Atoms"
                  className="relative h-16 w-auto opacity-95 sm:h-20"
                  loading="eager"
                  fetchPriority="high"
                />
              </div>
            )}

            {/* Dots */}
            {slides.length > 1 && (
              <div className="absolute bottom-5 left-6 flex gap-2" style={{ zIndex: 10 }}>
                {slides.map((slide, i) => (
                  <button key={`${i}-${slide.url}`} type="button" onClick={() => goToSlide(i)}
                    aria-label={`Show slide ${i + 1} of ${slides.length}`}
                    aria-current={i === heroIndex ? "true" : undefined}
                    className={`h-2 rounded-full transition-all duration-300 ${i === heroIndex ? "w-6 bg-white shadow" : "w-2 bg-white/50"}`} />
                ))}
              </div>
            )}

            {/* Arrows */}
            {slides.length > 1 && (
              <>
                <button type="button"
                  onClick={() => goToSlide((heroIndex - 1 + slides.length) % slides.length)}
                  aria-label="Previous slide"
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/80 backdrop-blur-sm border border-white/60 shadow flex items-center justify-center text-stone-700 hover:bg-white transition"
                  style={{ zIndex: 10 }}>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M13 16l-6-6 6-6" /></svg>
                </button>
                <button type="button"
                  onClick={() => goToSlide((heroIndex + 1) % slides.length)}
                  aria-label="Next slide"
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/80 backdrop-blur-sm border border-white/60 shadow flex items-center justify-center text-stone-700 hover:bg-white transition"
                  style={{ zIndex: 10 }}>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M7 4l6 6-6 6" /></svg>
                </button>
              </>
            )}
          </div>

          {/* Copy column */}
          <div className="min-w-0">
            <p className="section-label mb-4">Core Atoms — Nutraceuticals</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.08] text-stone-900">
              {heroCopy.headline}<br />
              <span className="text-brand">{heroCopy.headlineAccent}</span>
            </h1>
            <p className="mt-6 text-[15px] text-stone-500 leading-relaxed max-w-sm">{heroCopy.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/shop" className="btn-primary px-6 py-3 text-[14px]">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 13.846 4.632 15 6.414 15H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 5H6.28l-.31-1.243A1 1 0 005 3H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg>
                {heroCopy.primaryCta || "Shop all products"}
              </Link>
              <a href="#best-sellers" className="btn-ghost px-6 py-3 text-[14px]">
                {heroCopy.secondaryCta || "View best sellers"} →
              </a>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-3 pt-8 border-t border-line">
              {trust.slice(0, 3).map((t) => (
                <div key={t.label} className="text-center group">
                  <div className="text-xl mb-1 group-hover:scale-110 transition-transform duration-300">{t.icon}</div>
                  <div className="text-[11px] font-medium text-stone-500">{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── TRUST STRIP (pillars) ────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="bg-canvas border-b border-line">
          <Container className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-6">
            {pillars.map((p, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-2xl text-brand">{p.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-ink">{p.title}</div>
                  <div className="text-xs text-stone-500 hidden sm:block">{p.desc}</div>
                </div>
              </div>
            ))}
          </Container>
        </section>
      </ScrollReveal>

      {/* ── SHOP BY NEED ──────────────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="py-16">
          <Container>
            <div className="mb-8">
              <p className="section-label">Shop by need</p>
              <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-stone-900">Find your formula</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.map((cat, i) => (
                <Link
                  key={i}
                  to={`/shop?category=${encodeURIComponent(cat.category)}`}
                  className="group relative block aspect-square overflow-hidden rounded-2xl border border-line bg-white transition hover:border-brand/30 hover:shadow-md"
                >
                  {cat.image ? (
                    <>
                      <img src={cat.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-white/90 px-3 py-2 text-xs font-semibold text-ink">
                        {cat.label}
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <div className="h-14 w-14 rounded-full bg-brand-soft grid place-items-center text-2xl">{cat.emoji}</div>
                      <span className="text-xs font-semibold text-stone-700 group-hover:text-brand">{cat.label}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </Container>
        </section>
      </ScrollReveal>

      {/* ── BEST SELLERS ──────────────────────────────────────────────────── */}
      <ScrollReveal>
        <section id="best-sellers" className="bg-white border-y border-line py-16">
          <Container>
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="section-label">Top picks</p>
                <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-stone-900">Best sellers</h2>
              </div>
              <Link to="/shop" className="text-sm font-semibold text-brand hover:underline underline-offset-2">View all →</Link>
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
          </Container>
        </section>
      </ScrollReveal>

      {/* ── WHY US (proof band) ──────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="bg-brand text-white py-16 lg:py-20">
          <Container className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">{whyUs.label}</p>
              <h2 className="mt-3 text-3xl lg:text-4xl font-semibold tracking-tight">{whyUs.heading}</h2>
              <p className="mt-4 text-white/80 leading-relaxed">{whyUs.body}</p>
              <Link to="/shop" className="mt-8 inline-flex rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand">
                {whyUs.cta}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {whyUs.stats.slice(0, 4).map((s, i) => (
                <div key={i} className="rounded-2xl border border-white/15 bg-white/10 p-6">
                  <div className="text-3xl font-semibold">{s.value}</div>
                  <div className="mt-1 text-sm text-white/75">{s.label}</div>
                </div>
              ))}
            </div>
          </Container>
        </section>
      </ScrollReveal>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <ScrollReveal>
        <Testimonials reviews={reviews} />
      </ScrollReveal>

      {/* ── PHILOSOPHY ────────────────────────────────────────────────────── */}
      <ScrollReveal variant="scale">
        <section className="py-16">
          <Container>
            <div className="rounded-3xl border border-line bg-white p-12 lg:p-16 text-center">
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
            </div>
          </Container>
        </section>
      </ScrollReveal>
    </div>
  );
}

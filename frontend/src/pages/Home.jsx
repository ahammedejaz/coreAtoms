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
 *   homepage_why_us, homepage_standards, homepage_education, gst_percentage.
 * Testimonials are read separately from `product_reviews` via
 * `services/homepage.fetchHomepageReviews()`.
 *
 * Three sections are derived from the live catalogue rather than settings:
 * the "Shop by goal" chips (every product's `best_for`), the daily schedule
 * in "When to take what" (every product's `recommended_stack`) and "What's inside"
 * (product names against the ingredient index). See services/homepage.js.
 *
 * This file only loads data and orders the sections; each section lives in
 * `components/home/`. Section order: hero, pillars panel, category tiles and
 * goals, best sellers, daily schedule, a full-bleed photo break, the
 * Formulary standard (pinned on desktop), ingredient index, proof band
 * (navy), testimonials, a second photo break, education, FAQ preview,
 * recently viewed, manifesto. The photo breaks reuse the hero slides the
 * admin uploaded (the second and third), so they appear only when those exist.
 *
 * @module pages/Home
 */
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchProducts } from "../services/products";
import { supabase } from "../services/supabase/client";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import { SkeletonCard } from "../components/Skeleton";
import ScrollReveal, { ScrollRevealGroup } from "../components/ScrollReveal";
import RevealText from "../components/fx/RevealText";
import PromoBanner from "../components/PromoBanner";
import Testimonials from "../components/Testimonials";
import RecentlyViewed from "../components/RecentlyViewed";
import Hero from "../components/home/Hero";
import Pillars from "../components/home/Pillars";
import CategoryIndex from "../components/home/CategoryIndex";
import Routine from "../components/home/Routine";
import Standard from "../components/home/Standard";
import IngredientIndex from "../components/home/IngredientIndex";
import ProofBand from "../components/home/ProofBand";
import Education from "../components/home/Education";
import FaqPreview from "../components/home/FaqPreview";
import Manifesto from "../components/home/Manifesto";
import PhotoBreak from "../components/home/PhotoBreak";
import {
  DEFAULT_HOME_CATEGORIES,
  DEFAULT_WHY_US,
  DEFAULT_STANDARDS,
  DEFAULT_EDUCATION,
  fetchHomepageReviews,
  deriveGoals,
  buildRoutine,
  buildIngredientIndex,
} from "../services/homepage";
import { useSiteContent } from "../services/siteContent";
import { DEFAULTS, HOME_SECTIONS } from "../content/siteContent";

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
  return <div className={`mx-auto max-w-6xl px-5 sm:px-6 ${className}`}>{children}</div>;
}

/** Horizontal strip of the pinned best sellers with arrow controls. */
function BestSellers({ products, loading, error, onRetry, onAdd, justAddedId, gstPercent, title = "Best sellers", sub = "The formulas customers come back for." }) {
  const scrollerRef = useRef(null);
  const nudge = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section id="best-sellers" className="scroll-mt-24 border-y border-line bg-white py-14 lg:py-20" aria-labelledby="best-sellers-heading">
      <Container>
        <ScrollReveal>
          <div className="flex items-end justify-between gap-6">
            <div>
              <RevealText id="best-sellers-heading" text={title} className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl" />
              <p className="mt-2 text-[15px] text-stone-500">{sub}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link to="/shop" className="btn-secondary mr-2 hidden sm:inline-flex">
                View all
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </Link>
              <button type="button" onClick={() => nudge(-1)} className="btn-icon h-11 w-11" aria-label="Scroll best sellers left">
                <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => nudge(1)} className="btn-icon h-11 w-11" aria-label="Scroll best sellers right">
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>
        </ScrollReveal>

        {loading ? (
          <div className="mt-8 grid grid-cols-2 gap-x-4 lg:grid-cols-4 lg:gap-x-6">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="mt-8 border-t border-line py-16 text-center">
            <p className="font-display text-xl font-semibold text-ink">Unable to load products</p>
            <p className="mt-1 text-sm text-stone-500">{error}</p>
            <button type="button" onClick={onRetry} className="btn-primary mt-5">Try again</button>
          </div>
        ) : (
          <div
            ref={scrollerRef}
            className="no-scrollbar -mx-5 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 scroll-px-5 sm:-mx-6 sm:px-6 sm:scroll-px-6 lg:gap-6"
          >
            <ScrollRevealGroup stagger={70} className="w-[68vw] shrink-0 snap-start sm:w-[42vw] lg:w-[calc((100%-4.5rem)/4)]">
              {products.map((p) => (
                <ProductCard key={p.id} p={p} onAdd={onAdd} justAdded={justAddedId === p.id} gstPercent={gstPercent} />
              ))}
            </ScrollRevealGroup>
          </div>
        )}
        <Link to="/shop" className="btn-secondary mt-6 w-full sm:hidden">
          View all products
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </Link>
      </Container>
    </section>
  );
}

export default function Home() {
  const { addItem } = useCart();

  const [allProducts, setAllProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [justAddedId, setJustAddedId] = useState(null);

  // Settings state. `heroImages` is `null` until `app_settings` resolves so
  // the hero never shows the product fallback for a frame before real
  // photographs arrive.
  const [heroImages, setHeroImages] = useState(null);
  const [heroCopy, setHeroCopy] = useState(DEFAULT_HERO_COPY);
  const [pillars, setPillars] = useState(DEFAULT_PILLARS);
  const [categories, setCategories] = useState(DEFAULT_HOME_CATEGORIES);
  const [philosophy, setPhilosophy] = useState(DEFAULT_PHILOSOPHY);
  const [whyUs, setWhyUs] = useState(DEFAULT_WHY_US);
  const [standards, setStandards] = useState(DEFAULT_STANDARDS);
  const [education, setEducation] = useState(DEFAULT_EDUCATION);
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
            "homepage_standards",
            "homepage_education",
            "gst_percentage",
          ]),
        fetchProducts(),
        // Testimonials must never fail the page.
        fetchHomepageReviews().catch(() => []),
      ]);

      const map = {};
      (settingsRes.data || []).forEach((row) => { map[row.key] = row.value; });

      // Hero images — support old string[] and new {url,position}[].
      const rawImgs = Array.isArray(map.homepage_hero_images) ? map.homepage_hero_images : [];
      setHeroImages(rawImgs.map((item) =>
        typeof item === "string"
          ? { url: item, position: "50% 50%" }
          : { url: item?.url || "", position: item?.position || "50% 50%" }
      ));

      if (map.homepage_hero_copy && typeof map.homepage_hero_copy === "object") {
        setHeroCopy({ ...DEFAULT_HERO_COPY, ...map.homepage_hero_copy });
      }
      if (Array.isArray(map.homepage_pillars) && map.homepage_pillars.length > 0) {
        setPillars(map.homepage_pillars);
      }
      if (Array.isArray(map.homepage_categories) && map.homepage_categories.length > 0) {
        setCategories(map.homepage_categories);
      }
      if (map.homepage_philosophy && typeof map.homepage_philosophy === "object") {
        setPhilosophy({ ...DEFAULT_PHILOSOPHY, ...map.homepage_philosophy });
      }
      if (map.homepage_why_us && typeof map.homepage_why_us === "object") {
        setWhyUs({
          ...DEFAULT_WHY_US,
          ...map.homepage_why_us,
          stats: Array.isArray(map.homepage_why_us.stats) && map.homepage_why_us.stats.length > 0
            ? map.homepage_why_us.stats
            : DEFAULT_WHY_US.stats,
        });
      }
      if (Array.isArray(map.homepage_standards) && map.homepage_standards.length > 0) {
        setStandards(map.homepage_standards);
      }
      if (Array.isArray(map.homepage_education) && map.homepage_education.length > 0) {
        setEducation(map.homepage_education);
      }
      setGstPercent(Number(map.gst_percentage?.percentage ?? 0));

      setAllProducts(productList);
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

  const btnTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(btnTimerRef.current), []);

  /** Adds to cart with button feedback; the cart drawer is the confirmation. */
  const handleAdd = useCallback((p) => {
    addItem(p, 1);
    setJustAddedId(p.id);
    clearTimeout(btnTimerRef.current);
    btnTimerRef.current = setTimeout(() => setJustAddedId(null), 900);
  }, [addItem]);

  const trust = heroCopy.trustIcons || DEFAULT_HERO_COPY.trustIcons;

  /** Every heading, line and the section order, from Admin → Site content. */
  const home = useSiteContent("page_home");
  const faqContent = useSiteContent("page_faq");

  // The standard and the education panels can be saved in two places: the
  // newer Site content editor wins when it has them, then the older Home
  // settings, then the defaults.
  const standardRows = home.standards !== DEFAULTS.page_home.standards
    ? home.standards
    : (standards !== DEFAULT_STANDARDS ? standards : home.standards);
  const educationCards = home.education.cards !== DEFAULTS.page_home.education.cards
    ? home.education.cards
    : (education !== DEFAULT_EDUCATION ? education : home.education.cards);

  /** The home page's FAQ picks, resolved against the FAQ page's questions. */
  const homeFaqs = useMemo(() => {
    const all = (faqContent.groups || []).flatMap((g) => g?.items || []).filter((f) => f?.q && f?.a);
    const norm = (v) => String(v || "").trim().toLowerCase();
    const picks = (home.faq?.picks || []).map((q) => all.find((f) => norm(f.q) === norm(q))).filter(Boolean);
    return picks.length > 0 ? picks : all.slice(0, 5);
  }, [faqContent, home.faq?.picks]);

  /** Saved order and visibility, with any section the save predates appended. */
  const sectionOrder = useMemo(() => {
    const known = HOME_SECTIONS.map((x) => x.key);
    const seen = new Set();
    const list = [];
    (Array.isArray(home.sections) ? home.sections : []).forEach((x) => {
      if (x?.key && known.includes(x.key) && !seen.has(x.key)) { seen.add(x.key); list.push({ key: x.key, visible: x.visible !== false }); }
    });
    known.forEach((k) => { if (!seen.has(k)) list.push({ key: k, visible: true }); });
    return list;
  }, [home.sections]);

  /** Shown on the hero only when no photographs are saved. */

  /** The second and third hero slides double as the photo breaks. */
  const breakImages = useMemo(() => {
    const list = (heroImages || []).filter((s) => s?.url);
    return [list[1] || null, list[2] || null];
  }, [heroImages]);

  /** Catalogue-derived sections. */
  const goals = useMemo(() => deriveGoals(allProducts), [allProducts]);
  const routine = useMemo(() => buildRoutine(allProducts), [allProducts]);
  const ingredients = useMemo(() => buildIngredientIndex(allProducts), [allProducts]);
  const activeCount = useMemo(() => allProducts.filter((p) => p.isActive !== false).length, [allProducts]);

  /** Store-wide rating, weighted by each product's review count. */
  const reviewSummary = useMemo(() => {
    let count = 0;
    let sum = 0;
    allProducts.forEach((p) => {
      if (p.reviewCount > 0 && p.avgRating != null) {
        count += p.reviewCount;
        sum += p.avgRating * p.reviewCount;
      }
    });
    return count > 0 ? { count, average: sum / count } : null;
  }, [allProducts]);

  const breaks = Array.isArray(home.breaks) ? home.breaks : [];
  const sections = {
    pillars: <Pillars pillars={pillars} />,
    categories: (
      <CategoryIndex
        categories={categories}
        products={allProducts}
        goals={goals}
        heading={home.categories.title}
        intro={home.categories.sub}
        goalsLabel={home.categories.goalsLabel}
      />
    ),
    bestSellers: (
      <BestSellers
        products={products}
        loading={loadingProducts}
        error={fetchError}
        onRetry={loadData}
        onAdd={handleAdd}
        justAddedId={justAddedId}
        gstPercent={gstPercent}
        title={home.bestSellers.title}
        sub={home.bestSellers.sub}
      />
    ),
    routine: (
      <Routine slots={routine} onAdd={handleAdd} justAddedId={justAddedId} heading={home.routine.title} intro={home.routine.sub} footnote={home.routine.footnote} />
    ),
    break1: breakImages[0] && breaks[0]?.text ? <PhotoBreak image={breakImages[0]} text={breaks[0].text} sub={breaks[0].sub} /> : null,
    standard: <Standard items={standardRows} heading={home.standard.title} intro={home.standard.intro} />,
    ingredients: <IngredientIndex items={ingredients} total={activeCount} heading={home.ingredients.title} intro={home.ingredients.sub} />,
    proof: <ProofBand whyUs={whyUs} />,
    testimonials: <Testimonials reviews={reviews} summary={reviewSummary} title={home.testimonials.title} />,
    break2: breakImages[1] && breaks[1]?.text ? <PhotoBreak image={breakImages[1]} text={breaks[1].text} sub={breaks[1].sub} align="center" /> : null,
    education: <Education cards={educationCards} heading={home.education.title} intro={home.education.sub} />,
    faq: <FaqPreview faqs={homeFaqs} title={home.faq.title} sub={home.faq.sub} />,
    recentlyViewed: (
      <Container>
        <RecentlyViewed gstPercent={gstPercent} className="py-12" title={home.recentlyViewed.title} />
      </Container>
    ),
    manifesto: <Manifesto philosophy={philosophy} />,
  };

  return (
    <div>
      <SEO
        title="Core Atoms | Nutraceuticals"
        description="Modern nutraceuticals designed for real routines. Clean formulas, structured stacks, COD available across India."
        canonical="/"
      />

      <PromoBanner />

      <Hero images={heroImages} copy={heroCopy} trust={trust} />

      {sectionOrder.map((x) => {
        if (!x.visible) return null;
        const el = sections[x.key];
        return el ? <Fragment key={x.key}>{el}</Fragment> : null;
      })}
    </div>
  );
}

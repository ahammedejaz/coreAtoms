import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useEffect, useState } from "react";
import { supabase } from "../services/supabase/client";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const FALLBACK_IMG = "/placeholder-product.jpg";

// ── Static data ────────────────────────────────────────────────────────────

const WHY_PILLARS = [
  {
    icon: "🧪",
    title: "Clean Labels",
    desc: "No proprietary blends, no unnecessary fillers. Every ingredient listed clearly with purpose.",
  },
  {
    icon: "🚚",
    title: "Cash on Delivery",
    desc: "Order with confidence. Pay only when your package arrives at your door.",
  },
  {
    icon: "⚡",
    title: "Fast Fulfillment",
    desc: "Orders dispatched within 24 hours. Delivered across India with live tracking.",
  },
  {
    icon: "🎯",
    title: "Precision Formulas",
    desc: "Science-backed dosages. No megadosing, no underdosing — just what your body actually needs.",
  },
];

const HOW_STEPS = [
  {
    step: "01",
    title: "Browse",
    desc: "Explore our range of precision-formulated nutraceuticals. Filter by category or goal.",
  },
  {
    step: "02",
    title: "Order",
    desc: "Add to cart and checkout in under a minute. Cash on delivery — no payment needed upfront.",
  },
  {
    step: "03",
    title: "Delivered",
    desc: "Your order is packed and dispatched within 24 hours. Delivered fresh to your door.",
  },
];

const TESTIMONIALS = [
  {
    name: "Arjun M.",
    location: "Mumbai",
    rating: 5,
    text: "Been using the Multivitamin and Fish Oil stack for 3 months. Energy levels are noticeably better and the COD option made it easy to try without any risk.",
    product: "Multivitamin Man + Fish Oil",
  },
  {
    name: "Priya S.",
    location: "Bangalore",
    rating: 5,
    text: "Finally a supplement brand that doesn't overclaim. The HSN formula actually works — my hair fall reduced significantly within 6 weeks.",
    product: "HSN for Man & Woman",
  },
  {
    name: "Rahul K.",
    location: "Delhi",
    rating: 5,
    text: "Osteorix Ginger has been a game changer for my post-workout recovery. Joints feel much more comfortable. Clean formula, great packaging.",
    product: "Osteorix Ginger",
  },
  {
    name: "Sneha T.",
    location: "Hyderabad",
    rating: 5,
    text: "Ordered twice already. The checkout is super smooth and delivery was faster than expected. Love that everything is clearly labeled.",
    product: "Marine Collagen Powder",
  },
];

const CATEGORIES = [
  { label: "Multivitamins", emoji: "💊", category: "Multivitamin" },
  { label: "Joint Support", emoji: "🦴", category: "Joint Support" },
  { label: "Bone & Joint", emoji: "🧬", category: "Bone & Joint" },
  { label: "Hair • Skin • Nails", emoji: "✨", category: "Hair • Skin • Nails" },
  { label: "Gut Health", emoji: "🌿", category: "Prebiotic" },
  { label: "Collagen", emoji: "🔬", category: "Collagen" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function Stars({ count = 5 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="text-amber-400 text-sm">★</span>
      ))}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function Home() {
  const cart = useCart();
  const addFn =
    cart?.addItem ||
    cart?.addToCart ||
    ((item) => console.warn("No addItem found", item));

  const heroImages = [
    "/hero/hero-1.jpg",
    "/hero/hero-2.jpg",
    "/hero/hero-3.jpg",
    "/hero/hero-4.jpg",
  ];

  const [index, setIndex] = useState(0);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [toast, setToast] = useState({ open: false, message: "" });

  // Hero auto-advance
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % heroImages.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Featured products — 6 latest
  useEffect(() => {
    (async () => {
      setLoadingProducts(true);
      const { data } = await supabase
        .from("products")
        .select("id,name,price_inr,image_url,stock_qty,category,description,is_active,created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);
      if (data) setFeaturedProducts(data);
      setLoadingProducts(false);
    })();
  }, []);

  const handleAddToCart = (product) => {
    addFn({
      id: product.id,
      name: product.name,
      unitPrice: product.price_inr,
      image: product.image_url,
      qty: 1,
    });
    setToast({ open: true, message: `${product.name} added to cart` });
    setTimeout(() => setToast({ open: false, message: "" }), 1800);
  };

  return (
    <div className="space-y-24">

      {/* ── HERO ── */}
      <section className="rounded-3xl border border-black/10 bg-white shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)] overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-0">

          {/* Slider */}
          <div className="relative overflow-hidden h-[380px] lg:h-[520px]">
            <div
              className="flex h-full w-full transition-transform duration-700 ease-out"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {heroImages.map((src, i) => (
                <div key={i} className="h-full w-full shrink-0 relative">
                  <img src={src} alt={`Hero ${i + 1}`} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-white/35 via-white/30 to-transparent" />
                </div>
              ))}
            </div>
            <div className="absolute bottom-6 left-8 flex gap-2">
              {heroImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-neutral-900" : "w-2 bg-neutral-400"}`}
                />
              ))}
            </div>
          </div>

          {/* Copy */}
          <div className="p-10 lg:p-14 flex flex-col justify-center">
            <p className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">Core Atoms</p>
            <h1 className="mt-3 text-4xl lg:text-5xl font-semibold tracking-tight text-neutral-900 leading-tight">
              Engineered for consistency.
            </h1>
            <p className="mt-6 text-neutral-600 leading-relaxed max-w-lg">
              Modern nutraceuticals designed for daily momentum. Clean formulas, structured stacks,
              and a premium experience from checkout to delivery.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/shop"
                className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium bg-gradient-to-r from-neutral-900 to-neutral-700 text-white shadow-sm hover:shadow-md hover:from-neutral-800 hover:to-neutral-600 transition-all duration-200"
              >
                Shop Now
              </Link>
              <Link
                to="/shop"
                className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium bg-white text-neutral-900 border border-black/10 hover:bg-neutral-50 hover:shadow-sm transition-all duration-200"
              >
                View Best Sellers
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-neutral-500">
              <span className="flex items-center gap-1.5"><span>✓</span> Clean labels</span>
              <span className="flex items-center gap-1.5"><span>✓</span> COD available</span>
              <span className="flex items-center gap-1.5"><span>✓</span> Pan-India delivery</span>
            </div>
          </div>

        </div>
      </section>

      {/* ── WHY CORE ATOMS ── */}
      <section>
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">Why Us</p>
          <h2 className="mt-2 text-3xl font-semibold text-neutral-900">Built different. By design.</h2>
          <p className="mt-3 text-neutral-500 max-w-xl mx-auto">
            We don't cut corners on ingredients, and we don't cut corners on experience.
            Here's what sets Core Atoms apart.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WHY_PILLARS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl">{p.icon}</div>
              <div className="mt-4 text-base font-semibold text-neutral-900">{p.title}</div>
              <div className="mt-2 text-sm text-neutral-500 leading-relaxed">{p.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURED PRODUCTS ── */}
      <section>
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">Top Picks</p>
            <h2 className="mt-1 text-3xl font-semibold text-neutral-900">Featured Products</h2>
          </div>
          <Link to="/shop" className="text-sm font-medium text-neutral-700 hover:text-neutral-950 hover:underline">
            View all →
          </Link>
        </div>

        {loadingProducts ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden animate-pulse">
                <div className="h-56 bg-neutral-100" />
                <div className="p-5 space-y-3">
                  <div className="h-3 bg-neutral-100 rounded w-1/3" />
                  <div className="h-4 bg-neutral-100 rounded w-2/3" />
                  <div className="h-3 bg-neutral-100 rounded w-full" />
                  <div className="h-9 bg-neutral-100 rounded-xl mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="text-sm text-neutral-500">No products found.</div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.map((product) => (
              <div
                key={product.id}
                className="group rounded-2xl border border-neutral-200 bg-white shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
              >
                <Link to={`/product/${product.id}`} className="block overflow-hidden">
                  <img
                    src={product.image_url || FALLBACK_IMG}
                    alt={product.name}
                    className="h-56 w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
                  />
                </Link>

                <div className="p-5 space-y-3">
                  {product.category && (
                    <div className="text-xs inline-block px-3 py-1 rounded-full bg-neutral-100 text-neutral-600 font-medium">
                      {product.category}
                    </div>
                  )}

                  <Link to={`/product/${product.id}`} className="block text-lg font-semibold text-neutral-900 hover:underline leading-snug">
                    {product.name}
                  </Link>

                  {product.description && (
                    <p className="text-sm text-neutral-500 line-clamp-2">{product.description}</p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-lg font-semibold text-neutral-900">{money(product.price_inr)}</div>
                    <div className={`text-xs font-medium flex items-center gap-1 ${product.stock_qty > 0 ? "text-emerald-600" : "text-red-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${product.stock_qty > 0 ? "bg-emerald-500" : "bg-red-500"}`} />
                      {product.stock_qty > 0 ? "In Stock" : "Out of Stock"}
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={product.stock_qty <= 0}
                    className={`w-full rounded-xl py-2.5 text-sm font-medium transition-all ${
                      product.stock_qty > 0
                        ? "bg-neutral-900 text-white hover:bg-neutral-700"
                        : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                    }`}
                  >
                    {product.stock_qty > 0 ? "Add to Cart" : "Unavailable"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── CATEGORY STRIP ── */}
      <section>
        <div className="text-center mb-10">
          <p className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">Browse by Goal</p>
          <h2 className="mt-2 text-3xl font-semibold text-neutral-900">Shop by Category</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.category}
              to={`/shop?category=${encodeURIComponent(cat.category)}`}
              className="group rounded-2xl border border-neutral-200 bg-white p-5 text-center shadow-sm hover:shadow-md hover:border-neutral-400 transition-all duration-200"
            >
              <div className="text-3xl">{cat.emoji}</div>
              <div className="mt-3 text-xs font-semibold text-neutral-700 group-hover:text-neutral-950 leading-snug">
                {cat.label}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="rounded-3xl border border-neutral-200 bg-neutral-50 p-10 lg:p-16">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">Simple Process</p>
          <h2 className="mt-2 text-3xl font-semibold text-neutral-900">How it works</h2>
          <p className="mt-3 text-neutral-500 max-w-md mx-auto">
            From discovery to delivery — the Core Atoms experience is designed to be effortless.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3 relative">
          {/* Connector line — desktop only */}
          <div className="hidden sm:block absolute top-8 left-[20%] right-[20%] h-px bg-neutral-200" />

          {HOW_STEPS.map((s, i) => (
            <div key={s.step} className="relative text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-white border border-neutral-200 shadow-sm flex items-center justify-center">
                <span className="text-xl font-semibold text-neutral-900">{s.step}</span>
              </div>
              <div className="mt-5 text-base font-semibold text-neutral-900">{s.title}</div>
              <div className="mt-2 text-sm text-neutral-500 leading-relaxed max-w-xs mx-auto">{s.desc}</div>
              {i < HOW_STEPS.length - 1 && (
                <div className="hidden sm:block absolute top-8 -right-4 text-neutral-300 text-xl">→</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section>
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">Reviews</p>
          <h2 className="mt-2 text-3xl font-semibold text-neutral-900">What customers say</h2>
          <p className="mt-3 text-neutral-500">Real people. Real results. No paid reviews.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm flex flex-col gap-4">
              <Stars count={t.rating} />
              <p className="text-sm text-neutral-600 leading-relaxed flex-1">"{t.text}"</p>
              <div className="border-t border-neutral-100 pt-4">
                <div className="text-sm font-semibold text-neutral-900">{t.name}</div>
                <div className="text-xs text-neutral-400 mt-0.5">{t.location} • {t.product}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust bar */}
        <div className="mt-10 rounded-2xl border border-neutral-200 bg-neutral-50 px-8 py-6 flex flex-wrap items-center justify-center gap-10 text-center">
          <div>
            <div className="text-2xl font-semibold text-neutral-900">500+</div>
            <div className="text-xs text-neutral-500 mt-0.5">Happy Customers</div>
          </div>
          <div className="h-8 w-px bg-neutral-200 hidden sm:block" />
          <div>
            <div className="text-2xl font-semibold text-neutral-900">4.9★</div>
            <div className="text-xs text-neutral-500 mt-0.5">Average Rating</div>
          </div>
          <div className="h-8 w-px bg-neutral-200 hidden sm:block" />
          <div>
            <div className="text-2xl font-semibold text-neutral-900">12</div>
            <div className="text-xs text-neutral-500 mt-0.5">Products</div>
          </div>
          <div className="h-8 w-px bg-neutral-200 hidden sm:block" />
          <div>
            <div className="text-2xl font-semibold text-neutral-900">24h</div>
            <div className="text-xs text-neutral-500 mt-0.5">Dispatch Time</div>
          </div>
        </div>
      </section>

      {/* ── BRAND POSITIONING ── */}
      <section className="rounded-3xl border border-black/10 bg-white p-10 lg:p-14 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.25)] space-y-6">
        <p className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">Our Philosophy</p>
        <h2 className="text-3xl font-semibold text-neutral-900">Built like a system, not a trend.</h2>
        <p className="text-neutral-600 leading-relaxed max-w-2xl">
          Each Core Atoms formulation is designed around consistency — functional ingredients,
          simplified stacks, and structured support for real-world routines.
        </p>
        <p className="text-neutral-600 leading-relaxed max-w-2xl">
          No inflated claims. No unnecessary fillers. Just premium precision and daily reliability.
        </p>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="rounded-3xl overflow-hidden bg-neutral-900 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.07)_0%,_transparent_60%)]" />
        <div className="relative px-10 py-16 lg:py-20 flex flex-col items-center text-center gap-6">
          <p className="text-xs font-semibold tracking-widest text-neutral-400 uppercase">Ready to start?</p>
          <h2 className="text-3xl lg:text-4xl font-semibold text-white leading-tight max-w-xl">
            Your daily stack is waiting.
          </h2>
          <p className="text-neutral-400 max-w-md leading-relaxed">
            Precision formulas, clean ingredients, cash on delivery. No risk, no compromise.
            Start building your routine today.
          </p>
          <div className="flex flex-wrap gap-4 justify-center mt-2">
            <Link
              to="/shop"
              className="inline-flex items-center justify-center rounded-xl px-8 py-3.5 text-sm font-semibold bg-white text-neutral-900 hover:bg-neutral-100 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Shop All Products
            </Link>
            <Link
              to="/shop"
              className="inline-flex items-center justify-center rounded-xl px-8 py-3.5 text-sm font-semibold border border-white/20 text-white hover:bg-white/10 transition-all duration-200"
            >
              View Categories
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-4 text-xs text-neutral-500">
            <span>✓ No advance payment</span>
            <span>✓ Pan-India delivery</span>
            <span>✓ Dispatched in 24 hours</span>
            <span>✓ Clean ingredient labels</span>
          </div>
        </div>
      </section>

      {/* ── TOAST ── */}
      <div
        className={[
          "fixed bottom-5 right-5 z-50 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-lg",
          "text-sm text-neutral-900 transition-all duration-300",
          toast.open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none",
        ].join(" ")}
      >
        <div className="font-semibold">Added to cart ✅</div>
        <div className="text-xs text-neutral-600">{toast.message}</div>
      </div>

    </div>
  );
}

import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useEffect, useState } from "react";
import { supabase } from "../services/supabase/client";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const FALLBACK_IMG = "/placeholder-product.jpg"; // put an image in /public or change this path

export default function Home() {
  const cart = useCart();
  const addFn =
    cart?.addToCart ||
    cart?.addItem ||
    cart?.add ||
    ((item) => console.warn("No addToCart/addItem found", item));

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

  useEffect(() => {
    const loadProducts = async () => {
      setLoadingProducts(true);
      const { data, error } = await supabase
        .from("products")
        .select("id,name,price_inr,image_url,stock_qty,category,description,is_active,created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) {
        console.error("Home featured products load error:", error);
      } else {
        console.log("Home featured products:", data);
        if (data) setFeaturedProducts(data);
      }
      setLoadingProducts(false);
    };

    loadProducts();
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
    setTimeout(() => {
      setToast({ open: false, message: "" });
    }, 1800);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % heroImages.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-20">

      {/* PREMIUM HERO SECTION */}
      <section className="rounded-3xl border border-black/10 bg-white shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)] overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-0">

          {/* LEFT — BIG PREMIUM BANNER SLIDER */}
          <div className="relative overflow-hidden h-[380px] lg:h-[500px]">
            <div
              className="flex h-full w-full transition-transform duration-700 ease-out"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {heroImages.map((src, i) => (
                <div key={i} className="h-full w-full shrink-0 relative">
                  <img
                    src={src}
                    alt={`Hero ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                  {/* subtle white overlay for luxury softness */}
                  <div className="absolute inset-0 bg-gradient-to-r from-white/35 via-white/30 to-transparent" />
                </div>
              ))}
            </div>

            {/* Dots */}
            <div className="absolute bottom-6 left-8 flex gap-2">
              {heroImages.map((_, i) => (
                <div
                  key={i}
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    i === index ? "bg-black/70" : "bg-black/30"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* RIGHT — COPY + CTA */}
          <div className="p-10 lg:p-14 flex flex-col justify-center">
            <p className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">
              Core Atoms
            </p>

            <h1 className="mt-3 text-4xl lg:text-5xl font-semibold tracking-tight text-neutral-900 leading-tight">
              Engineered for consistency.
            </h1>

            <p className="mt-6 text-neutral-600 leading-relaxed max-w-lg">
              Modern nutraceuticals designed for daily momentum.
              Clean formulas, structured stacks, and a premium experience
              from checkout to delivery.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/shop"
                className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium
                           bg-gradient-to-r from-neutral-200 to-neutral-300 text-neutral-900
                           border border-black/10
                           shadow-sm hover:shadow-md
                           hover:from-neutral-100 hover:to-neutral-200
                           transition-all duration-200"
              >
                Explore Products
              </Link>

              <Link
                to="/shop"
                className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium
                           bg-white text-neutral-900 border border-black/10
                           hover:bg-neutral-50 hover:shadow-sm
                           transition-all duration-200"
              >
                View Best Sellers
              </Link>
            </div>

            <div className="mt-8 text-sm text-neutral-500">
              Trusted ingredients • Clean labels • Fast fulfillment
            </div>
          </div>

        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section>
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-2xl font-semibold text-neutral-900">
            Featured Products
          </h2>
          <Link to="/shop" className="text-sm text-neutral-700 hover:underline">
            View all →
          </Link>
        </div>
        {loadingProducts ? (
          <div className="text-sm text-neutral-500">Loading products...</div>
        ) : featuredProducts.length === 0 ? (
          <div className="text-sm text-neutral-500">
            No featured products found. (Check: products.is_active = true and price_inr/image_url columns)
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl border border-neutral-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* Product Image */}
                <Link to={`/product/${product.id}`}>
                  <img
                    src={product.image_url || FALLBACK_IMG}
                    alt={product.name}
                    className="h-56 w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK_IMG;
                    }}
                  />
                </Link>

                {/* Product Info */}
                <div className="p-5 space-y-3">

                  {/* Category Badge */}
                  {product.category && (
                    <div className="text-xs inline-block px-3 py-1 rounded-full bg-neutral-100 text-neutral-600 font-medium">
                      {product.category}
                    </div>
                  )}

                  {/* Product Name */}
                  <Link
                    to={`/product/${product.id}`}
                    className="block text-lg font-semibold text-neutral-900 hover:underline"
                  >
                    {product.name}
                  </Link>

                  {/* Short Description */}
                  {product.description && (
                    <p className="text-sm text-neutral-500 line-clamp-2">
                      {product.description}
                    </p>
                  )}

                  {/* Price + Stock Row */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-base font-semibold text-neutral-900">
                      {money(product.price_inr)}
                    </div>

                    <div
                      className={`text-xs font-medium ${
                        product.stock_qty > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {product.stock_qty > 0 ? "In Stock" : "Out of Stock"}
                    </div>
                  </div>

                  {/* Add to Cart */}
                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={product.stock_qty <= 0}
                    className={`mt-3 w-full rounded-xl py-2 text-sm font-medium transition ${
                      product.stock_qty > 0
                        ? "bg-gradient-to-r from-neutral-300 to-neutral-400 text-neutral-900 border border-neutral-300 hover:from-neutral-200 hover:to-neutral-300"
                        : "bg-neutral-200 text-neutral-500 cursor-not-allowed"
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

      {/* BRAND POSITIONING BLOCK */}
      <section className="rounded-3xl border border-black/10 bg-white p-14 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.25)] space-y-6">
        <h2 className="text-2xl font-semibold text-neutral-900">
          Built Like a System, Not a Trend
        </h2>

        <p className="text-neutral-600 leading-relaxed">
          Each Core Atoms formulation is designed around consistency —
          functional ingredients, simplified stacks, and structured support
          for real-world routines.
        </p>

        <p className="text-neutral-600 leading-relaxed">
          No inflated claims. No unnecessary fillers.
          Just premium precision and daily reliability.
        </p>
      </section>

      {/* Toast Notification */}
      {toast.open && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-black text-white px-5 py-3 text-sm shadow-lg animate-fade-in">
          {toast.message}
        </div>
      )}
    </div>
  );
}

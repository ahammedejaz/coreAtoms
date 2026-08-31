/**
 * ProductDetail.jsx — Single-product page with variant selection.
 *
 * Fetches one product by URL param `:id` and `gst_percentage` from
 * `app_settings` in parallel. Shows image gallery with thumbnails,
 * variant picker, quantity stepper, stock/order-limit warnings,
 * highlight pills, about section, and customer reviews.
 *
 * The price label reads "Excl. GST & Shipping" when GST > 0,
 * or "Excl. Shipping" when GST is disabled.
 *
 * Uses composite cart keys (`productId_variantId`) for variant items.
 *
 * Also emits Product / BreadcrumbList / FAQPage JSON-LD, each only when the
 * product genuinely has the data behind it.
 *
 * @module pages/ProductDetail
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { fetchProductById } from "../services/products";
import { supabase } from "../services/supabase/client";
import SEO from "../components/SEO";
import PincodeChecker from "../components/PincodeChecker";
import RichText from "../components/RichText";
import BenefitIcon from "../components/BenefitIcon";
import { SkeletonProductDetail } from "../components/Skeleton";
import RelatedProducts from "../components/RelatedProducts";
import { useToast } from "../context/ToastContext";

import { money } from "../utils/format";

const BRAND_NAME = "Core Atoms";

function cartKey(productId, variantId) {
  return variantId ? `${productId}_${variantId}` : String(productId);
}

/** Collapses pasted line breaks and double spaces into a single meta-safe line. */
function plainText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

/**
 * Trims to roughly what a SERP snippet shows, cutting on a word boundary.
 * Product descriptions here run to several thousand characters.
 */
function truncateForMeta(value, max = 155) {
  const clean = plainText(value);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.replace(/[\s.,;:—-]+$/, "")}…`;
}

/**
 * Applies / clears the 2× gallery zoom directly on the <img>. Kept imperative
 * so pointer moves don't re-render the whole page.
 */
function applyZoom(container, clientX, clientY) {
  const img = container.querySelector("img");
  if (!img) return;
  const rect = container.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = ((clientY - rect.top) / rect.height) * 100;
  img.style.transformOrigin = `${x}% ${y}%`;
  img.style.transform = "scale(2)";
}

function clearZoom(container) {
  const img = container?.querySelector("img");
  if (!img) return;
  img.style.transformOrigin = "center center";
  img.style.transform = "scale(1)";
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { items, addItem, maxItems, updateQty } = useCart();
  const { showToast } = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const [gstPercent, setGstPercent] = useState(0);

  useEffect(() => {
    if (!id) {
      setErr("Invalid product URL.");
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const [p, gstRes] = await Promise.all([
          fetchProductById(id),
          supabase.from("app_settings").select("value").eq("key", "gst_percentage").maybeSingle(),
        ]);
        if (alive) {
          setProduct(p);
          setActiveImg(0);
          setGstPercent(Number(gstRes?.data?.value?.percentage ?? 0));
          if (p?.variants?.length > 0) {
            const firstAvail = p.variants.find((v) => v.stockQty > 0) || p.variants[0];
            setSelectedVariant(firstAvail);
          } else {
            setSelectedVariant(null);
          }
        }
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load product");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const hasVariants = (product?.variants?.length ?? 0) > 0;
  const activePrice = selectedVariant ? selectedVariant.price : (product?.price ?? 0);
  const activeStock = selectedVariant ? selectedVariant.stockQty : (product?.stockQty ?? 0);
  const activeKey = cartKey(id, selectedVariant?.id);

  const cartItem = useMemo(
    () => (items || []).find((x) => x.id === activeKey),
    [items, activeKey]
  );
  const cartQty = cartItem?.qty || 0;

  const cartCount = useMemo(() => (items || []).reduce((s, x) => s + (Number(x.qty) || 0), 0), [items]);
  const remainingInOrder = Math.max(0, Number(maxItems || 0) - cartCount);
  const remainingStock = Math.max(0, activeStock - cartQty);
  const canAdd = remainingInOrder > 0 && remainingStock > 0;

  const handlePlus = () => {
    if (!id || !product || !canAdd) return;
    const itemName = selectedVariant ? `${product.name} — ${selectedVariant.label}` : product.name;
    addItem({
      id: activeKey,
      name: itemName,
      image: product.image,
      category: product.category,
      price: activePrice,
      unitPrice: activePrice,
    }, 1);
    showToast(`${itemName} added to cart`, "success");
  };

  const handleMinus = () => {
    if (!cartItem) return;
    updateQty(activeKey, Math.max(0, cartQty - 1));
  };

  const images = (product?.images?.length > 0 ? product.images : [product?.image]).filter(Boolean);

  /* ── Gallery zoom: hover on mouse, tap-to-toggle on touch/pen ── */
  const galleryRef = useRef(null);
  const tapStartRef = useRef(null);
  const tapZoomedRef = useRef(false);

  const resetGalleryZoom = () => {
    tapZoomedRef.current = false;
    clearZoom(galleryRef.current);
  };

  const pageTitle = product ? `${product.name} | ${BRAND_NAME}` : `Product | ${BRAND_NAME}`;
  // An untruncated description can run past 6,000 characters — no search engine
  // shows that, and a bloated <meta> is worse than a tight one.
  const pageDescription = truncateForMeta(product?.description) ||
    "Premium nutraceutical supplement from Core Atoms.";

  /**
   * Structured data. Nothing is invented: aggregateRating appears only with
   * real reviews, FAQPage only with real FAQs, availability comes from stock.
   */
  const structuredData = useMemo(() => {
    if (!product) return [];
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/product/${product.id}`;
    const variants = product.variants || [];
    const inStock = variants.length > 0
      ? variants.some((v) => (v.stockQty ?? 0) > 0)
      : (product.stockQty ?? 0) > 0;

    const productNode = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      brand: { "@type": "Brand", name: BRAND_NAME },
      offers: {
        "@type": "Offer",
        url,
        priceCurrency: "INR",
        price: Number(product.price ?? 0).toFixed(2),
        availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        seller: { "@type": "Organization", name: BRAND_NAME },
      },
    };
    const description = plainText(product.description);
    const imageList = (product.images?.length > 0 ? product.images : [product.image]).filter(Boolean);
    if (description) productNode.description = description;
    if (product.sku) productNode.sku = product.sku;
    if (imageList.length > 0) productNode.image = imageList;
    if (product.category) productNode.category = product.category;
    if (product.reviewCount > 0 && product.avgRating) {
      productNode.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: Number(product.avgRating),
        reviewCount: product.reviewCount,
        bestRating: 5,
        worstRating: 1,
      };
    }

    // Mirrors the on-page breadcrumb exactly, category segment included.
    const crumbs = [{ name: "Shop", item: `${origin}/shop` }];
    if (product.category) {
      crumbs.push({
        name: product.category,
        item: `${origin}/shop?category=${encodeURIComponent(product.category)}`,
      });
    }
    crumbs.push({ name: product.name, item: url });
    const breadcrumbNode = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: c.item,
      })),
    };

    const faqs = (product.details?.faqs || []).filter((f) => f.q && f.a);
    const faqNode = faqs.length > 0 ? {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    } : null;

    return [productNode, breadcrumbNode, faqNode].filter(Boolean);
  }, [product]);

  /* ── Loading skeleton ── */
  if (loading) {
    return <SkeletonProductDetail />;
  }

  /* ── Error ── */
  if (err || !product) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="card p-8">
          <p className="text-lg font-semibold text-stone-900">Product not found</p>
          <p className="mt-1 text-sm text-stone-500">{err || "This product may be inactive."}</p>
          <Link to="/shop" className="btn-ghost mt-5 inline-flex">← Back to Shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16 overflow-x-hidden">
      <SEO
        title={pageTitle}
        description={pageDescription}
        ogImage={product.image}
        canonical={`/product/${product.id}`}
        type="product"
      />

      {/* Structured data — stringified, never interpolated. */}
      {structuredData.map((node) => (
        <script
          key={node["@type"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
        />
      ))}

      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">

        {/* ── Breadcrumb ── */}
        <div className="mb-5 sm:mb-7 flex items-center gap-2 text-xs sm:text-sm text-stone-400">
          <Link to="/shop" className="hover:text-stone-700 transition-colors">Shop</Link>
          <span className="text-stone-300">/</span>
          {product.category && (
            <>
              <Link
                to={`/shop?category=${encodeURIComponent(product.category)}`}
                className="hover:text-stone-700 transition-colors"
              >
                {product.category}
              </Link>
              <span className="text-stone-300">/</span>
            </>
          )}
          <span className="text-stone-600 font-medium truncate max-w-[200px]">{product.name}</span>
        </div>

        {/* ── Two-column layout — items-start so columns don't stretch each other ── */}
        <div className="grid gap-5 sm:gap-8 lg:grid-cols-2 items-start overflow-hidden">

          {/* ══ LEFT — Image Gallery ══ */}
          <div className="space-y-3 lg:sticky lg:top-24 lg:self-start min-w-0">
            {/* Main image — hover zoom on mouse, tap-to-toggle zoom on touch,
                so the cursor-zoom-in affordance isn't a lie on a phone. */}
            <div
              ref={galleryRef}
              className="rounded-2xl border border-[#E8E4DE] bg-white overflow-hidden cursor-zoom-in aspect-[4/3] sm:aspect-auto sm:h-[440px]"
              onPointerMove={(e) => {
                if (e.pointerType === "mouse") applyZoom(e.currentTarget, e.clientX, e.clientY);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === "mouse") clearZoom(e.currentTarget);
              }}
              onPointerDown={(e) => {
                if (e.pointerType !== "mouse") tapStartRef.current = { x: e.clientX, y: e.clientY };
              }}
              onPointerUp={(e) => {
                if (e.pointerType === "mouse") return;
                const start = tapStartRef.current;
                tapStartRef.current = null;
                // A drag was a scroll, not a tap — leave the zoom alone.
                if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) return;
                if (tapZoomedRef.current) {
                  clearZoom(e.currentTarget);
                  tapZoomedRef.current = false;
                } else {
                  applyZoom(e.currentTarget, e.clientX, e.clientY);
                  tapZoomedRef.current = true;
                }
              }}
              onPointerCancel={() => { tapStartRef.current = null; resetGalleryZoom(); }}
            >
              <img
                src={images[activeImg] || product.image}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-300 ease-out"
                loading="eager"
                fetchPriority="high"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>

            {/* Thumbnail strip — only shown when multiple images exist */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((src, i) => (
                  <button
                    key={`${i}-${src}`}
                    type="button"
                    onClick={() => { setActiveImg(i); resetGalleryZoom(); }}
                    aria-label={`Show image ${i + 1} of ${images.length}`}
                    aria-current={i === activeImg ? "true" : undefined}
                    className={`shrink-0 h-16 w-16 rounded-xl border-2 overflow-hidden transition-all ${i === activeImg
                      ? "border-[#1e3a5f] shadow-sm"
                      : "border-[#E8E4DE] hover:border-stone-400"
                      }`}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ══ RIGHT — Product Info Card ══ */}
          <div className="rounded-2xl border border-[#E8E4DE] bg-white p-4 sm:p-7 flex flex-col gap-4 sm:gap-5 min-w-0">

            {/* Header */}
            <div>
              <div className="section-label mb-2">Core Atoms</div>
              <h1 className="text-2xl font-semibold tracking-tight text-stone-900 leading-snug">
                {product.name}
              </h1>

              {product.reviewCount > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`text-[15px] ${i <= Math.round(product.avgRating) ? "text-amber-400" : "text-stone-200"}`}
                      >★</span>
                    ))}
                  </div>
                  <span className="text-xs text-stone-400">
                    {Number(product.avgRating).toFixed(1)} ({product.reviewCount} review{product.reviewCount !== 1 ? "s" : ""})
                  </span>
                </div>
              )}

              <RichText
                text={product.description || "Clean formula. Daily consistency. Built for performance and recovery."}
                className="mt-3"
              />
            </div>

            {/* ── Divider ── */}
            <div className="border-t border-[#E8E4DE]" />

            {/* ── Variant Selector ── */}
            {hasVariants && (
              <div>
                <p className="text-sm font-semibold text-stone-800 mb-3">Choose your size</p>
                <div className="flex flex-wrap gap-2.5">
                  {product.variants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    const outOfStock = v.stockQty <= 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={outOfStock}
                        onClick={() => setSelectedVariant(v)}
                        className={`relative rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all duration-150 min-w-[90px] text-left ${outOfStock
                          ? "border-stone-200 text-stone-300 cursor-not-allowed bg-stone-50"
                          : isSelected
                            ? "border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-md"
                            : "border-[#E8E4DE] text-stone-700 bg-white hover:border-[#1e3a5f]/50 hover:bg-[#EFF6FF]"
                          }`}
                      >
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-white/20 flex items-center justify-center">
                            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                        <span className="block leading-tight">{v.label}</span>
                        <span className={`block text-[11px] font-medium mt-1 ${isSelected ? "text-white/75" : outOfStock ? "text-stone-300" : "text-[#1e3a5f]"
                          }`}>
                          {outOfStock ? "Out of stock" : money(v.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Price box ── */}
            <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 px-4 sm:px-5 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-stone-400 mb-1">
                  {hasVariants && selectedVariant ? `Price · ${selectedVariant.label}` : "Price"}
                </p>
                <div className="text-3xl font-semibold tracking-tight text-stone-900">
                  {money(activePrice)}
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  {Number(gstPercent) > 0 ? "Excl. GST & Shipping" : "Excl. Shipping"}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${activeStock > 0
                ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                : "bg-red-50 border border-red-200 text-red-600"
                }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${activeStock > 0 ? "bg-emerald-500" : "bg-red-500"}`} />
                {activeStock > 0 ? "In stock" : "Out of stock"}
              </span>
            </div>

            {/* ── Pincode Delivery Check ── */}
            <PincodeChecker />

            {/* ── Qty stepper + CTA ── */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Stepper */}
              <div className="inline-flex items-center rounded-xl border border-[#E8E4DE] bg-white shadow-sm">
                <button
                  type="button"
                  onClick={handleMinus}
                  disabled={cartQty <= 0}
                  className="h-11 w-11 rounded-l-xl flex items-center justify-center text-xl text-stone-500 hover:bg-stone-50 hover:text-stone-900 disabled:opacity-30 transition"
                >−</button>
                <div className="w-12 text-center text-base font-semibold text-stone-900">{cartQty}</div>
                <button
                  type="button"
                  onClick={handlePlus}
                  disabled={!canAdd}
                  className="h-11 w-11 rounded-r-xl flex items-center justify-center text-xl text-stone-500 hover:bg-stone-50 hover:text-stone-900 disabled:opacity-30 transition"
                >+</button>
              </div>

              {/* Add to cart */}
              <button
                type="button"
                onClick={handlePlus}
                disabled={!canAdd}
                className="btn-primary py-3 px-6 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 3a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 13.846 4.632 15 6.414 15H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 5H6.28l-.31-1.243A1 1 0 005 3H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                </svg>
                <span className="hidden sm:inline">{cartQty > 0 ? "Add more to cart" : "Add to cart"}</span>
              </button>

              {/* View cart shortcut */}
              {cartQty > 0 && (
                <button
                  type="button"
                  onClick={() => navigate("/cart")}
                  className="btn-ghost py-3 px-5"
                >
                  View cart ({cartQty})
                </button>
              )}
            </div>

            {/* Limit warnings */}
            {!canAdd && activeStock <= 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                This item is currently out of stock.
              </div>
            )}
            {!canAdd && activeStock > 0 && remainingInOrder <= 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Max {maxItems} items per order reached. Checkout or reduce quantities.
              </div>
            )}

            {/* ── Trust strip ── */}
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#E8E4DE] bg-stone-50/70 p-3 sm:grid-cols-4">
              {TRUST_POINTS.map((t) => (
                <div key={t.label} className="flex flex-col items-center gap-1.5 px-1 py-1.5 text-center">
                  <span className="text-[#1e3a5f]">{t.icon}</span>
                  <span className="text-[11px] font-medium leading-tight text-stone-600">{t.label}</span>
                </div>
              ))}
            </div>

            {/* ── Highlight pills ── */}
            {product.highlights?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.highlights.map((h) => (
                  <span
                    key={h}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E4DE] bg-white px-3 py-1 text-xs font-medium text-stone-600 shadow-sm"
                  >
                    <svg className="h-3 w-3 text-[#1e3a5f] shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {h}
                  </span>
                ))}
              </div>
            )}

            {/* ── Divider ── */}
            <div className="border-t border-[#E8E4DE]" />

            {/* ── Category + SKU — inline row, no sub-cards ── */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Category</p>
                <p className="text-sm font-semibold text-stone-800 mt-0.5">{product.category || "General"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">SKU</p>
                <p className="text-sm font-semibold text-stone-800 mt-0.5">
                  {selectedVariant?.sku || product.sku || String(product.id).slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>

          </div>
          {/* end right card */}
        </div>
        {/* end grid */}
      </div>

      {/* ── Rich detail sections — benefits, story, ingredients, usage, FAQs ── */}
      <ProductStory product={product} />

      {/* ── Reviews ── */}
      {product.reviews?.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 mt-6">
          <div className="rounded-2xl border border-[#E8E4DE] bg-white p-4 sm:p-7">

            {/* Reviews header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold text-stone-900">Customer Reviews</h2>
                <p className="text-xs text-stone-400 mt-0.5">{product.reviewCount} review{product.reviewCount !== 1 ? "s" : ""}</p>
              </div>
              {product.reviewCount > 0 && (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`text-lg leading-none ${i <= Math.round(product.avgRating) ? "text-amber-400" : "text-stone-200"}`}
                      >★</span>
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-stone-700">
                    {Number(product.avgRating).toFixed(1)} / 5.0
                  </span>
                </div>
              )}
            </div>

            {/* Review list */}
            <div className="divide-y divide-[#E8E4DE]">
              {product.reviews.map((r) => (
                <div key={r.id} className="py-5 first:pt-0 last:pb-0">
                  {/* Reviewer row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="h-9 w-9 rounded-full bg-[#EFF6FF] border border-[#E8E4DE] flex items-center justify-center text-[12px] font-bold text-[#1e3a5f] shrink-0">
                        {(r.reviewerName || "C")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-stone-800 leading-tight">{r.reviewerName}</p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {new Date(r.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    {/* Stars on the right */}
                    <div className="flex shrink-0">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span
                          key={i}
                          className={`text-[15px] leading-none ${i <= r.rating ? "text-amber-400" : "text-stone-200"}`}
                        >★</span>
                      ))}
                    </div>
                  </div>
                  {/* Review body */}
                  {(r.title || r.body) && (
                    <div className="mt-3 ml-0 sm:ml-12">
                      {r.title && (
                        <p className="text-sm font-semibold text-stone-800 mb-1">{r.title}</p>
                      )}
                      {r.body && (
                        <p className="text-sm text-stone-500 leading-relaxed">{r.body}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* ── Cross-sell ── */}
      <RelatedProducts productId={product.id} category={product.category} gstPercent={gstPercent} />

    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Below-the-fold detail sections. Each renders only when the admin has
   filled the matching content, so sparse products stay clean while rich
   ones read like a Centrum / 1mg product page.
   ══════════════════════════════════════════════════════════════════════ */

const TRUST_POINTS = [
  {
    label: "100% authentic",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2.8 4.8 5.6v5.2c0 4.6 3 8.9 7.2 10.4 4.2-1.5 7.2-5.8 7.2-10.4V5.6L12 2.8Z" />
        <path d="m9 11.8 2.2 2.2 4.2-4.4" />
      </svg>
    ),
  },
  {
    label: "Lab tested",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9.5 3h5M10.5 3v5.2L5.6 16.9A2.4 2.4 0 0 0 7.7 20.5h8.6a2.4 2.4 0 0 0 2.1-3.6L13.5 8.2V3" />
        <path d="M8.2 14.5h7.6" />
      </svg>
    ),
  },
  {
    label: "Secure payments",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
        <path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" />
        <circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Easy replacement",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4.6 9.5a7.7 7.7 0 0 1 14-2.1M19.4 14.5a7.7 7.7 0 0 1-14 2.1M19.4 3.6v3.8h-3.8M4.6 20.4v-3.8h3.8" />
      </svg>
    ),
  },
];

function SectionCard({ label, title, children }) {
  return (
    <div className="mx-auto max-w-6xl px-4 mt-6">
      <div className="rounded-2xl border border-[#E8E4DE] bg-white p-5 sm:p-8">
        <p className="section-label">{label}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-stone-900">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function BenefitsSection({ benefits }) {
  return (
    <SectionCard label="Key benefits" title="What it does for you">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map((b, i) => (
          <div
            key={i}
            className="rounded-xl border border-[#E8E4DE] bg-stone-50/60 p-4 transition-colors duration-200 hover:border-[#1e3a5f]/25 hover:bg-[#EFF6FF]/60"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e3a5f]/[0.07] text-[#1e3a5f]">
              <BenefitIcon name={b.icon} className="h-[18px] w-[18px]" />
            </div>
            <p className="mt-3 text-sm font-semibold text-stone-900">{b.title}</p>
            {b.text && <p className="mt-1 text-[13px] leading-relaxed text-stone-500">{b.text}</p>}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function AboutSection({ text }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 900;
  return (
    <SectionCard label="The full story" title="About this product">
      <div className={!expanded && isLong ? "relative max-h-80 overflow-hidden" : undefined}>
        <RichText text={text} />
        {!expanded && isLong && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
        )}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1e3a5f] hover:underline"
        >
          {expanded ? "Show less" : "Read the full details"}
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-3.5 w-3.5 transition-transform duration-200 ease-out ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414Z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </SectionCard>
  );
}

function IngredientsSection({ ingredients }) {
  const hasAmounts = ingredients.some((r) => r.amount);
  return (
    <SectionCard label="What's inside" title="Key ingredients">
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-[#E8E4DE] sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8E4DE] bg-stone-50 text-left">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Ingredient</th>
              {hasAmounts && (
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Amount</th>
              )}
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-stone-400">What it does</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E4DE] bg-white">
            {ingredients.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-3 align-top font-semibold text-stone-800">{r.name}</td>
                {hasAmounts && (
                  <td className="px-4 py-3 align-top whitespace-nowrap text-stone-600 tabular-nums">{r.amount || "—"}</td>
                )}
                <td className="px-4 py-3 align-top leading-relaxed text-stone-500">{r.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile stacked rows */}
      <div className="divide-y divide-[#E8E4DE] overflow-hidden rounded-xl border border-[#E8E4DE] bg-white sm:hidden">
        {ingredients.map((r, i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-stone-800">{r.name}</p>
              {r.amount && <p className="shrink-0 text-xs text-stone-500 tabular-nums">{r.amount}</p>}
            </div>
            {r.purpose && <p className="mt-1 text-[13px] leading-relaxed text-stone-500">{r.purpose}</p>}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function HowToUseSection({ steps }) {
  return (
    <SectionCard label="Daily ritual" title="How to use">
      <ol className="space-y-3.5">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-[12px] font-bold text-white">
              {i + 1}
            </span>
            <p className="pt-1 text-sm leading-relaxed text-stone-600">{step}</p>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

function RoutineSection({ product }) {
  return (
    <SectionCard label="Fits your routine" title="Build your stack">
      <div className="grid gap-4 sm:grid-cols-3">
        {product.bestFor && (
          <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-4">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">Best for</p>
            <p className="text-sm text-stone-700">{product.bestFor}</p>
          </div>
        )}
        {product.pairsWellWith && (
          <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-4">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">Pairs well with</p>
            <p className="text-sm text-stone-700">{product.pairsWellWith}</p>
          </div>
        )}
        {product.recommendedStack && (
          <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-4">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">Recommended stack</p>
            <p className="text-sm text-stone-700">{product.recommendedStack}</p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function FaqSection({ faqs }) {
  const [open, setOpen] = useState(null);
  return (
    <SectionCard label="Good to know" title="Frequently asked questions">
      <div className="divide-y divide-[#E8E4DE] overflow-hidden rounded-xl border border-[#E8E4DE] bg-white">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={i}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-stone-50 sm:px-5"
              >
                <span className="text-sm font-medium text-stone-800">{f.q}</span>
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 ease-out ${isOpen ? "rotate-45" : ""}`}
                  aria-hidden="true"
                >
                  <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                </svg>
              </button>
              <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 text-sm leading-relaxed text-stone-500 sm:px-5">{f.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function SafetySection({ text }) {
  return (
    <div className="mx-auto max-w-6xl px-4 mt-6">
      <div className="rounded-2xl border border-[#E8E4DE] bg-stone-50 p-5 sm:p-6">
        <div className="flex gap-3">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-stone-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2.8 4.8 5.6v5.2c0 4.6 3 8.9 7.2 10.4 4.2-1.5 7.2-5.8 7.2-10.4V5.6L12 2.8Z" />
            <path d="M12 8.2v4.4M12 15.8v.1" />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-700">Safety information</p>
            <RichText text={text} className="mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductStory({ product }) {
  const d = product.details || {};
  const hasRoutine = product.bestFor || product.pairsWellWith || product.recommendedStack;
  return (
    <>
      {d.benefits?.length > 0 && <BenefitsSection benefits={d.benefits} />}
      {product.aboutText && <AboutSection text={product.aboutText} />}
      {d.ingredients?.length > 0 && <IngredientsSection ingredients={d.ingredients} />}
      {d.howToUse?.length > 0 && <HowToUseSection steps={d.howToUse} />}
      {hasRoutine && <RoutineSection product={product} />}
      {d.faqs?.length > 0 && <FaqSection faqs={d.faqs} />}
      {d.safetyInfo && <SafetySection text={d.safetyInfo} />}
      <div className="mx-auto max-w-6xl px-4 mt-8">
        <p className="text-[11px] leading-relaxed text-stone-400">
          Nutraceutical supplements are not a substitute for a varied, balanced diet or a healthy
          lifestyle, and are not intended to diagnose, treat, cure or prevent any disease. Consult
          your healthcare professional before use if you are pregnant, nursing, on medication or
          have a medical condition.
        </p>
      </div>
    </>
  );
}

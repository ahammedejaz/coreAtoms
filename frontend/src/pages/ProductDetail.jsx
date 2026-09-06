/**
 * ProductDetail.jsx — Single-product page with variant selection.
 *
 * Fetches one product by URL param `:id` and `gst_percentage` from
 * `app_settings` in parallel. Sticky gallery with thumbnails on the left; on
 * the right a buy column with no card shell: variant picker, price block,
 * quantity stepper, stock and order-limit warnings, pincode check, trust
 * row, highlight pills and metadata.
 *
 * Below the fold every content section renders only when the admin has
 * filled it: benefits, the full story, a Supplement-Facts ingredient panel,
 * how to use, the routine, FAQs, safety information, then reviews with a
 * `RatingBreakdown`, recently viewed and the cross-sell strip.
 *
 * `StickyAddToCart` renders a bottom bar on mobile (`lg:hidden`) mirroring
 * the buy column's add-to-cart controls.
 *
 * Uses composite cart keys (`productId_variantId`) for variant items, and
 * emits Product / BreadcrumbList / FAQPage JSON-LD only when the product
 * genuinely has the data behind it.
 *
 * @module pages/ProductDetail
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Star, BadgeCheck, FlaskConical, Lock, RefreshCw, ChevronRight, Minus, Plus,
  ShoppingBag, Share2, Check, ChevronDown, ShieldAlert, CircleAlert, PackageSearch,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { fetchProductById } from "../services/products";
import { supabase } from "../services/supabase/client";
import SEO from "../components/SEO";
import PincodeChecker from "../components/PincodeChecker";
import RichText from "../components/RichText";
import BenefitIcon from "../components/BenefitIcon";
import { SkeletonProductDetail } from "../components/Skeleton";
import RelatedProducts from "../components/RelatedProducts";
import RecentlyViewed from "../components/RecentlyViewed";
import RatingBreakdown from "../components/RatingBreakdown";
import StickyAddToCart from "../components/StickyAddToCart";
import { useToast } from "../context/ToastContext";
import useRecentlyViewed from "../hooks/useRecentlyViewed";
import Magnetic from "../components/fx/Magnetic";
import { useSiteContent } from "../services/siteContent";

import { money, discountPercent } from "../utils/format";

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

/** Long pasted descriptions collapse to a few lines with a "Read more". */
function ClampedText({ text }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 320;
  return (
    <div>
      <div className={!expanded && isLong ? "relative max-h-[8.75rem] overflow-hidden" : undefined}>
        <RichText text={text} />
        {!expanded && isLong && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-canvas to-transparent" />
        )}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline underline-offset-4"
        >
          {expanded ? "Show less" : "Read more"}
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ease-out ${expanded ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default function ProductDetail() {
  const pageCopy = useSiteContent("page_product");
  const { id } = useParams();
  const navigate = useNavigate();
  const { items, addItem, maxItems, updateQty } = useCart();
  const { showToast } = useToast();
  const { record: recordViewed } = useRecentlyViewed();

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
          if (p?.id) recordViewed(p.id);
        }
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load product");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, recordViewed]);

  const hasVariants = (product?.variants?.length ?? 0) > 0;
  const activePrice = selectedVariant ? selectedVariant.price : (product?.price ?? 0);
  // MRP follows the selected variant so the strikethrough always belongs to
  // the price on screen. baseMrp is the product's own column — `product.mrp`
  // is the card-level display value and may come from a different variant.
  const activeMrp = selectedVariant ? selectedVariant.mrp : (product?.baseMrp ?? null);
  const activeOffPct = discountPercent(activeMrp, activePrice);
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
    // Same "Name — Variant" shape the mobile app writes, so order lines match across platforms.
    const itemName = selectedVariant ? `${product.name} — ${selectedVariant.label}` : product.name;
    addItem({
      id: activeKey,
      name: itemName,
      image: product.image,
      category: product.category,
      price: activePrice,
      unitPrice: activePrice,
    }, 1);
  };

  const handleMinus = () => {
    if (!cartItem) return;
    updateQty(activeKey, Math.max(0, cartQty - 1));
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: product?.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast("Link copied", "success");
    } catch {
      /* user dismissed the share sheet */
    }
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

  if (loading) {
    return <SkeletonProductDetail />;
  }

  if (err || !product) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
        <div className="border-t border-line py-16 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-bone text-brand">
            <PackageSearch className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <p className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink">Product not found</p>
          <p className="mt-1.5 text-sm text-stone-500">{err || "This product may be inactive."}</p>
          <Link to="/shop" className="btn-secondary mt-6">Back to the shop</Link>
        </div>
      </div>
    );
  }

  const inStock = activeStock > 0;

  return (
    <div className="pb-28 lg:pb-16">
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

      <div className="mx-auto max-w-6xl px-5 pt-5 sm:px-6 sm:pt-8">

        {/* ── Breadcrumb ── */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12.5px] text-stone-500">
          <Link to="/shop" className="transition-colors hover:text-ink">Shop</Link>
          <ChevronRight className="h-3.5 w-3.5 text-stone-300" strokeWidth={2} aria-hidden="true" />
          {product.category && (
            <>
              <Link to={`/shop?category=${encodeURIComponent(product.category)}`} className="transition-colors hover:text-ink">
                {product.category}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-stone-300" strokeWidth={2} aria-hidden="true" />
            </>
          )}
          <span className="max-w-[220px] truncate font-medium text-ink" aria-current="page">{product.name}</span>
        </nav>

        {/* ── Two-column layout ── */}
        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">

          {/* ══ Gallery ══ */}
          <div className="min-w-0 space-y-3 lg:sticky lg:top-32 lg:self-start">
            <div className="relative">
              <div
                ref={galleryRef}
                className="aspect-square cursor-zoom-in overflow-hidden rounded-[28px] bg-bone"
                data-cursor="Zoom"
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
                  className="product-img h-full w-full object-contain transition-transform duration-300 ease-out-strong"
                  loading="eager"
                  fetchPriority="high"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <button type="button" onClick={handleShare} className="btn-icon absolute right-4 top-4 h-10 w-10 shadow-float" aria-label="Share this product">
                <Share2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </button>
              {activeOffPct && (
                <span className="absolute left-4 top-4 rounded-full bg-amber-soft px-3 py-1.5 text-xs font-semibold text-amber-deep">
                  Save {activeOffPct}%
                </span>
              )}
            </div>

            {images.length > 1 && (
              <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 py-1 no-scrollbar">
                {images.map((src, i) => (
                  <button
                    key={`${i}-${src}`}
                    type="button"
                    onClick={() => { setActiveImg(i); resetGalleryZoom(); }}
                    aria-label={`Show image ${i + 1} of ${images.length}`}
                    aria-current={i === activeImg ? "true" : undefined}
                    className={`h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-bone ring-2 ring-offset-2 ring-offset-canvas transition-[ring-color] duration-150 ${i === activeImg ? "ring-ink" : "ring-transparent hover:ring-line-strong"}`}
                  >
                    <img src={src} alt="" className="product-img h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ══ Buy column ══ */}
          <div className="min-w-0 lg:pt-1">
            {product.category && (
              <Link to={`/shop?category=${encodeURIComponent(product.category)}`} className="text-[12.5px] font-medium text-stone-500 transition-colors hover:text-brand">
                {product.category}
              </Link>
            )}
            <h1 className="mt-1.5 font-display text-[2rem] font-semibold leading-[1.02] tracking-[-0.03em] text-ink sm:text-[2.6rem]">
              {product.name}
            </h1>

            {product.reviewCount > 0 && (
              <a href="#reviews" className="mt-3.5 inline-flex items-center gap-2 text-[13px] text-stone-600 hover:text-ink">
                <span className="flex items-center gap-px" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i <= Math.round(product.avgRating) ? "text-amber" : "text-line-strong"}`}
                      fill="currentColor"
                      strokeWidth={0}
                    />
                  ))}
                </span>
                <span className="font-semibold text-ink tabular-nums">{Number(product.avgRating).toFixed(1)}</span>
                <span className="underline decoration-line-strong underline-offset-4">{product.reviewCount} review{product.reviewCount !== 1 ? "s" : ""}</span>
              </a>
            )}

            <div className="mt-5">
              <ClampedText text={product.description || "Clean formula. Daily consistency. Built for performance and recovery."} />
            </div>

            {/* Variants */}
            {hasVariants && (
              <fieldset className="mt-7 border-t border-line pt-6">
                <legend className="sr-only">Size</legend>
                <p className="text-[13px] font-semibold text-ink">
                  Size{selectedVariant && <span className="font-normal text-stone-500">: {selectedVariant.label}</span>}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    const outOfStock = v.stockQty <= 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={outOfStock}
                        onClick={() => setSelectedVariant(v)}
                        aria-pressed={isSelected}
                        className={`rounded-full border px-4 py-2.5 text-left transition-[background-color,border-color,color,scale] duration-150 ease-out-strong active:scale-[0.97] ${outOfStock
                          ? "cursor-not-allowed border-line text-stone-300"
                          : isSelected
                            ? "border-ink bg-ink text-white"
                            : "border-line-strong bg-white text-ink hover:border-ink"}`}
                      >
                        <span className="block text-[13.5px] font-semibold leading-tight">{v.label}</span>
                        <span className={`block text-[11.5px] tabular-nums ${isSelected ? "text-white/70" : outOfStock ? "text-stone-300" : "text-stone-500"}`}>
                          {outOfStock ? "Sold out" : money(v.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* Price */}
            <div className={`${hasVariants ? "mt-6" : "mt-7 border-t border-line pt-6"}`}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-display text-[2.6rem] font-semibold leading-none tracking-[-0.035em] text-ink tabular-nums sm:text-5xl">
                  {money(activePrice)}
                </span>
                {activeOffPct && <s className="text-lg text-stone-400 tabular-nums">{money(activeMrp)}</s>}
              </div>
              <p className="mt-2 text-xs text-stone-500">
                {Number(gstPercent) > 0 ? "Excl. GST and shipping." : "Excl. shipping."}
                {hasVariants && selectedVariant && <> Price for {selectedVariant.label}.</>}
              </p>
              <p className={`mt-3 inline-flex items-center gap-2 text-[13px] font-medium ${inStock ? "text-emerald-700" : "text-red-700"}`}>
                <span className={`h-2 w-2 rounded-full ${inStock ? "bg-emerald-500" : "bg-red-500"}`} aria-hidden="true" />
                {inStock ? "In stock" : "Out of stock"}
              </p>
            </div>

            {/* Qty + Add */}
            <div className="mt-6 flex items-stretch gap-3">
              <div className="inline-flex shrink-0 items-center rounded-full border border-line-strong bg-white p-1" role="group" aria-label="Quantity in cart">
                <button
                  type="button"
                  onClick={handleMinus}
                  disabled={cartQty <= 0}
                  className="grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-bone disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="Remove one from cart"
                >
                  <Minus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </button>
                <span className="w-9 text-center text-[15px] font-semibold tabular-nums text-ink" aria-live="polite">{cartQty}</span>
                <button
                  type="button"
                  onClick={handlePlus}
                  disabled={!canAdd}
                  className="grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-bone disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="Add one to cart"
                >
                  <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
              <Magnetic className="flex-1" strength={0.2}>
                <button
                  type="button"
                  onClick={handlePlus}
                  disabled={!canAdd}
                  className="btn-primary btn-lg w-full disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ShoppingBag className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  {!inStock ? "Sold out" : cartQty > 0 ? "Add another" : "Add to cart"}
                </button>
              </Magnetic>
            </div>
            {cartQty > 0 && (
              <p className="mt-3 text-[13px] text-stone-600">
                {cartQty} in your cart.{" "}
                <button type="button" onClick={() => navigate("/cart")} className="font-semibold text-brand hover:underline underline-offset-4">View cart</button>
              </p>
            )}

            {!canAdd && activeStock <= 0 && (
              <p className="mt-4 flex items-start gap-2 text-sm text-red-700">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                This item is currently out of stock.
              </p>
            )}
            {!canAdd && activeStock > 0 && remainingInOrder <= 0 && (
              <p className="mt-4 flex items-start gap-2 text-sm text-amber-deep">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                Max {maxItems} items per order reached. Checkout or reduce quantities.
              </p>
            )}

            <div className="mt-7 border-t border-line pt-6">
              <PincodeChecker />
            </div>

            {/* Trust row */}
            <ul className="mt-7 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-line py-5">
              {TRUST_POINTS.map(({ label, icon: Icon }, i) => ({ icon: Icon, label: pageCopy.trustPoints?.[i] || label })).map(({ label, icon: Icon }) => (
                <li key={label} className="flex items-center gap-2.5 text-[12.5px] font-medium text-stone-700">
                  <Icon className="h-[18px] w-[18px] shrink-0 text-brand" strokeWidth={1.6} aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>

            {product.highlights?.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {product.highlights.map((h) => (
                  <li key={h} className="pill">
                    <Check className="h-3 w-3 text-brand" strokeWidth={2.5} aria-hidden="true" />
                    {h}
                  </li>
                ))}
              </ul>
            )}

            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <div>
                <dt className="text-stone-500">Category</dt>
                <dd className="mt-0.5 font-semibold text-ink">{product.category || "General"}</dd>
              </div>
              <div>
                <dt className="text-stone-500">SKU</dt>
                <dd className="mt-0.5 font-semibold text-ink tabular-nums">
                  {selectedVariant?.sku || product.sku || String(product.id).slice(0, 8).toUpperCase()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* ── Detail sections ── */}
      <ProductStory product={product} />

      {/* ── Reviews ── */}
      {product.reviews?.length > 0 && (
        <Section id="reviews" title={pageCopy.sectionTitles.reviews}>
          <RatingBreakdown reviews={product.reviews} avgRating={product.avgRating} reviewCount={product.reviewCount} />
          <ul className="mt-8 divide-y divide-line border-t border-line">
            {product.reviews.map((r) => (
              <li key={r.id} className="py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-[12px] font-bold text-brand">
                      {(r.reviewerName || "C")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight text-ink">{r.reviewerName}</p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i <= r.rating ? "text-amber" : "text-line-strong"}`}
                        fill="currentColor"
                        strokeWidth={0}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                </div>
                {(r.title || r.body) && (
                  <div className="mt-3 sm:ml-12">
                    {r.title && <p className="mb-1 text-sm font-semibold text-ink">{r.title}</p>}
                    {r.body && <p className="text-[15px] leading-relaxed text-stone-600">{r.body}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <StickyAddToCart
        price={activePrice}
        mrp={activeMrp}
        offPct={activeOffPct}
        inStock={inStock}
        canAdd={canAdd}
        cartQty={cartQty}
        onAdd={handlePlus}
        onViewCart={() => navigate("/cart")}
      />

      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <RecentlyViewed excludeId={product.id} gstPercent={gstPercent} className="mt-16 border-t border-line pt-12" />
      </div>
      <RelatedProducts productId={product.id} category={product.category} gstPercent={gstPercent} title={pageCopy.sectionTitles.related} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Below-the-fold detail sections. Each renders only when the admin has
   filled the matching content, so sparse products stay clean while rich
   ones read like a full product monograph.
   ══════════════════════════════════════════════════════════════════════ */

const TRUST_POINTS = [
  { label: "100% authentic", icon: BadgeCheck },
  { label: "Lab tested", icon: FlaskConical },
  { label: "Secure payments", icon: Lock },
  { label: "Easy replacement", icon: RefreshCw },
];

/** Heading in the left column, content in the right: the monograph layout. */
function Section({ id, title, children }) {
  return (
    <section id={id} className="mx-auto mt-14 max-w-6xl border-t border-line px-5 pt-10 sm:px-6 lg:mt-16 lg:pt-12">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h2>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

function BenefitsSection({ benefits }) {
  return (
    <Section title={useSiteContent("page_product").sectionTitles.benefits}>
      <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {benefits.map((b, i) => (
          <li key={i} className="flex gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-bone text-brand">
              <BenefitIcon name={b.icon} className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink">{b.title}</p>
              {b.text && <p className="mt-1 text-[14px] leading-relaxed text-stone-600">{b.text}</p>}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function AboutSection({ text }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 900;
  return (
    <Section title={useSiteContent("page_product").sectionTitles.about}>
      <div className={!expanded && isLong ? "relative max-h-80 overflow-hidden" : undefined}>
        <RichText text={text} />
        {!expanded && isLong && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-canvas to-transparent" />
        )}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline underline-offset-4"
        >
          {expanded ? "Show less" : "Read the full details"}
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ease-out ${expanded ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </Section>
  );
}

function IngredientsSection({ ingredients }) {
  const hasAmounts = ingredients.some((r) => r.amount);
  const pageCopy = useSiteContent("page_product");

  return (
    <Section title={pageCopy.sectionTitles.inside}>
      <div className="facts max-w-xl">
        <p className="facts-title">Supplement Facts</p>
        <p className="facts-sub">{hasAmounts ? "Amount per serving" : "Key ingredients"}</p>
        {ingredients.map((r, i) => (
          <div key={i} className="facts-row flex-col items-stretch gap-0.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-semibold text-ink">{r.name}</span>
              {r.amount && <span className="facts-val">{r.amount}</span>}
            </div>
            {r.purpose && <span className="text-[13px] leading-snug text-stone-500">{r.purpose}</span>}
          </div>
        ))}
        <p className="facts-foot">Ingredients as disclosed on the product label.</p>
      </div>
    </Section>
  );
}

function HowToUseSection({ steps }) {
  return (
    <Section title={useSiteContent("page_product").sectionTitles.howToUse}>
      <ol className="space-y-5">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-5">
            <span className="w-8 shrink-0 font-display text-3xl font-semibold leading-none tracking-tight text-line-strong tabular-nums" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="pt-1 text-[15px] leading-relaxed text-stone-700">{step}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function RoutineSection({ product }) {
  const cells = [
    product.bestFor && { label: "Best for", text: product.bestFor },
    product.pairsWellWith && { label: "Pairs well with", text: product.pairsWellWith },
    product.recommendedStack && { label: "Recommended stack", text: product.recommendedStack },
  ].filter(Boolean);
  return (
    <Section title={useSiteContent("page_product").sectionTitles.stack}>
      <dl className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {cells.map((c) => (
          <div key={c.label} className="py-4 sm:px-6 sm:py-1 sm:first:pl-0 sm:last:pr-0">
            <dt className="text-xs font-semibold text-stone-500">{c.label}</dt>
            <dd className="mt-1.5 text-[15px] leading-relaxed text-ink">{c.text}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function FaqSection({ faqs }) {
  const [open, setOpen] = useState(null);
  return (
    <Section title={useSiteContent("page_product").sectionTitles.faqs}>
      <div className="divide-y divide-line border-y border-line">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={i}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 py-4 text-left"
              >
                <span className="text-[15px] font-semibold text-ink">{f.q}</span>
                <Plus className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 ease-out ${isOpen ? "rotate-45" : ""}`} strokeWidth={2} aria-hidden="true" />
              </button>
              <div className={`grid transition-[grid-template-rows] duration-250 ease-out-strong ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <p className="pb-5 pr-8 text-[15px] leading-relaxed text-stone-600">{f.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function SafetySection({ text }) {
  return (
    <Section title={useSiteContent("page_product").sectionTitles.safety}>
      <div className="flex gap-4 rounded-panel bg-bone p-5 sm:p-6">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-brand" strokeWidth={1.6} aria-hidden="true" />
        <RichText text={text} />
      </div>
    </Section>
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
      <div className="mx-auto mt-10 max-w-6xl px-5 sm:px-6">
        <p className="max-w-3xl text-[12px] leading-relaxed text-stone-500">{useSiteContent("page_product").disclaimer}</p>
      </div>
    </>
  );
}

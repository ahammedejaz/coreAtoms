/**
 * ProductDetail.jsx — Single-product page with variant selection.
 *
 * Fetches one product by URL param `:id`, shows image gallery with
 * thumbnails, variant picker, quantity stepper, stock/order-limit
 * warnings, highlight pills, about section, and customer reviews.
 * Uses composite cart keys (`productId_variantId`) for variant items.
 *
 * @module pages/ProductDetail
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { fetchProductById } from "../services/products";
import SEO from "../components/SEO";
import PincodeChecker from "../components/PincodeChecker";
import { SkeletonProductDetail } from "../components/Skeleton";

import { money } from "../utils/format";

function cartKey(productId, variantId) {
  return variantId ? `${productId}_${variantId}` : String(productId);
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { items, addItem, maxItems, updateQty } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const p = await fetchProductById(id);
        if (alive) {
          setProduct(p);
          setActiveImg(0);
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
    if (!product || !canAdd) return;
    addItem({
      id: activeKey,
      name: selectedVariant ? `${product.name} — ${selectedVariant.label}` : product.name,
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

  const images = (product?.images?.length > 0 ? product.images : [product?.image]).filter(Boolean);

  const pageTitle = product ? `${product.name} | Core Atoms` : "Product | Core Atoms";
  const pageDescription = product?.description || "Premium nutraceutical supplement from Core Atoms.";

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
    <div className="pb-16">
      <SEO title={pageTitle} description={pageDescription} ogImage={product.image} />
      <div className="mx-auto max-w-6xl px-4 py-10">

        {/* ── Breadcrumb ── */}
        <div className="mb-7 flex items-center gap-2 text-sm text-stone-400">
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
        <div className="grid gap-8 lg:grid-cols-2 items-start">

          {/* ══ LEFT — Image Gallery ══ */}
          <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
            {/* Main image with hover zoom */}
            <div
              className="rounded-2xl border border-[#E8E4DE] bg-white overflow-hidden cursor-zoom-in"
              style={{ height: 440 }}
              onMouseMove={(e) => {
                const img = e.currentTarget.querySelector("img");
                if (!img) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                img.style.transformOrigin = `${x}% ${y}%`;
                img.style.transform = "scale(2)";
              }}
              onMouseLeave={(e) => {
                const img = e.currentTarget.querySelector("img");
                if (!img) return;
                img.style.transformOrigin = "center center";
                img.style.transform = "scale(1)";
              }}
            >
              <img
                src={images[activeImg] || product.image}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-300 ease-out"
                loading="lazy"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>

            {/* Thumbnail strip — only shown when multiple images exist */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImg(i)}
                    className={`shrink-0 h-16 w-16 rounded-xl border-2 overflow-hidden transition-all ${i === activeImg
                      ? "border-[#1e3a5f] shadow-sm"
                      : "border-[#E8E4DE] hover:border-stone-400"
                      }`}
                  >
                    <img src={src} alt={`View ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ══ RIGHT — Product Info Card ══ */}
          <div className="rounded-2xl border border-[#E8E4DE] bg-white p-7 flex flex-col gap-5">

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

              <p className="mt-3 text-[14px] text-stone-500 leading-relaxed">
                {product.description || "Clean formula. Daily consistency. Built for performance and recovery."}
              </p>
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
            <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-400 mb-1">
                  {hasVariants && selectedVariant ? `Price · ${selectedVariant.label}` : "Price"}
                </p>
                <div className="text-3xl font-semibold tracking-tight text-stone-900">
                  {money(activePrice)}
                </div>
                <p className="text-xs text-stone-400 mt-1">Excl. GST & Shipping</p>
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
                className="btn-primary flex-1 sm:flex-none py-3 px-6 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 3a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 13.846 4.632 15 6.414 15H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 5H6.28l-.31-1.243A1 1 0 005 3H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                </svg>
                {cartQty > 0 ? "Add more to cart" : "Add to cart"}
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

      {/* ── About section ── */}
      {(product.aboutText || product.bestFor || product.pairsWellWith || product.recommendedStack) && (
        <div className="mx-auto max-w-6xl px-4 mt-6">
          <div className="rounded-2xl border border-[#E8E4DE] bg-white p-7">
            <h2 className="text-base font-semibold text-stone-900 mb-1">About this product</h2>
            {product.aboutText && (
              <p className="text-sm text-stone-500 leading-relaxed mt-2 mb-5">{product.aboutText}</p>
            )}
            {(product.bestFor || product.pairsWellWith || product.recommendedStack) && (
              <div className="grid gap-4 sm:grid-cols-3 mt-4">
                {product.bestFor && (
                  <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Best for</p>
                    <p className="text-sm text-stone-700">{product.bestFor}</p>
                  </div>
                )}
                {product.pairsWellWith && (
                  <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Pairs well with</p>
                    <p className="text-sm text-stone-700">{product.pairsWellWith}</p>
                  </div>
                )}
                {product.recommendedStack && (
                  <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Recommended stack</p>
                    <p className="text-sm text-stone-700">{product.recommendedStack}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Reviews ── */}
      {product.reviews?.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 mt-6">
          <div className="rounded-2xl border border-[#E8E4DE] bg-white p-7">

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
                    <div className="mt-3 ml-12">
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

    </div>
  );
}

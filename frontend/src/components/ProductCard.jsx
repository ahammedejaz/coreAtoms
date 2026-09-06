/**
 * ProductCard.jsx — Catalogue product card used by Shop, Home and the
 * cross-sell strips.
 *
 * Image-led: a 4:5 bone tile carries the bottle (multiply-blended so the
 * studio backdrop disappears, and `object-contain` so a photograph of any
 * shape sits whole and centred instead of being cropped), the second photo
 * crossfades in on hover, and
 * the add-to-cart control lives on the tile. With a mouse it slides up from
 * the bottom edge on hover; on touch it is a round button that stays in
 * view. The copy block stays to three lines: name and price, the benefit
 * line from `best_for`, then rating.
 *
 * Lives here rather than inside Shop.jsx so that Home can render a product
 * without statically importing the whole Shop page.
 *
 * @param {{ p: object, onAdd: Function, justAdded: boolean, gstPercent: number }} props
 * @module components/ProductCard
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ImageOff, Star, Check, Plus, ArrowRight } from "lucide-react";
import { money, discountPercent } from "../utils/format";
import { isOutOfStock } from "../services/products";
import Tilt from "./fx/Tilt";

const NEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** Read once per page load; "New" is a 30-day window, so second precision is irrelevant. */
const LOADED_AT = Date.now();

export function Stars({ rating, count, className = "" }) {
  if (!count) return null;
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center gap-px" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${i <= Math.round(rating) ? "text-amber" : "text-line-strong"}`}
            fill="currentColor"
            strokeWidth={0}
          />
        ))}
      </div>
      <span className="text-[11.5px] text-stone-500 tabular-nums">
        <span className="sr-only">Rated </span>{Number(rating).toFixed(1)}<span className="text-stone-400"> ({count})</span>
      </span>
    </div>
  );
}

/**
 * `best_for` is admin text such as "Immunity • Skin health". The card shows
 * it as one quiet sentence; the separators are whatever the admin typed.
 */
function benefitLine(p) {
  const raw = String(p?.bestFor || "").trim();
  if (!raw) return "";
  return raw.split(/\s*[•·|,]\s*/).filter(Boolean).join(", ");
}

const ProductCard = React.memo(function ProductCard({ p, onAdd, justAdded, gstPercent }) {
  const variants = p.variants || [];
  const hasVariants = variants.length > 0;
  // Stock lives on the variant rows for variant products — the base `stock_qty`
  // is 0 for those, so reading it alone flagged sellable products as sold out.
  const out = isOutOfStock(p);

  // Tracks the src that failed so a stale Storage URL falls back to a neutral
  // placeholder instead of the browser's broken-image glyph.
  const [failedSrc, setFailedSrc] = useState(null);
  const imageBroken = !p.image || failedSrc === p.image;
  const hoverImage = (p.images || []).find((u) => u && u !== p.image) || null;

  // Strikethrough MRP renders only for a genuine discount (mrp > price).
  const offPct = discountPercent(p.mrp, p.price);
  const isNew = Boolean(p.createdAt) && LOADED_AT - new Date(p.createdAt).getTime() < NEW_WINDOW_MS;
  const benefit = benefitLine(p) || p.category || "";
  const href = `/product/${p.id}`;

  const addLabel = out ? `${p.name} is sold out` : justAdded ? `${p.name} added` : `Add ${p.name} to cart`;

  return (
    <article className="group relative flex h-full flex-col">
      {/* Tile */}
      <Tilt className="aspect-[4/5] overflow-hidden rounded-tile bg-bone transition-[box-shadow] duration-500 ease-out-strong can-hover:group-hover:shadow-lift-lg">
        <Link to={href} className="absolute inset-0 block" tabIndex={-1} aria-hidden="true" data-cursor="View">
          {imageBroken ? (
            <div className="grid h-full w-full place-items-center text-stone-300">
              <ImageOff className="h-8 w-8" strokeWidth={1.25} />
            </div>
          ) : (
            <>
              <img
                src={p.image}
                alt=""
                className={`product-img absolute inset-0 h-full w-full object-contain transition-[scale,opacity] duration-700 ease-out-strong can-hover:group-hover:scale-[1.06] ${hoverImage ? "can-hover:group-hover:opacity-0" : ""}`}
                style={{ objectPosition: p.imagePosition || "50% 50%" }}
                loading="lazy"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                onError={() => setFailedSrc(p.image)}
              />
              {hoverImage && (
                <img
                  src={hoverImage}
                  alt=""
                  className="product-img absolute inset-0 hidden h-full w-full scale-[1.06] object-contain opacity-0 transition-opacity duration-700 ease-out-strong can-hover:block can-hover:group-hover:opacity-100"
                  loading="lazy"
                  aria-hidden="true"
                />
              )}
            </>
          )}
        </Link>

        {/* Badges */}
        {(offPct || isNew || out) && (
          <div className="pointer-events-none absolute left-3.5 top-3.5 flex flex-wrap gap-1.5">
            {out ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50/95 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
                Sold out
              </span>
            ) : (
              <>
                {offPct && <span className="rounded-full bg-amber px-2.5 py-1 text-[11px] font-semibold text-ink">{offPct}% off</span>}
                {isNew && <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-white">New</span>}
              </>
            )}
          </div>
        )}

        {/* Add — a sibling of the image link, never nested inside it. */}
        {!out && (hasVariants ? (
          <>
            <Link
              to={href}
              aria-label={`Choose a size for ${p.name}`}
              className="absolute inset-x-3 bottom-3 hidden h-11 items-center justify-center gap-2 rounded-full bg-ink text-[13.5px] font-semibold text-white shadow-float transition-[translate,opacity,scale,background-color] duration-300 ease-out-strong hover:bg-brand active:scale-[0.97] can-hover:flex can-hover:translate-y-[calc(100%+1rem)] can-hover:opacity-0 can-hover:group-hover:translate-y-0 can-hover:group-hover:opacity-100 can-hover:group-focus-within:translate-y-0 can-hover:group-focus-within:opacity-100"
            >
              Choose a size
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <Link
              to={href}
              aria-label={`Choose a size for ${p.name}`}
              className="absolute bottom-3 right-3 inline-flex h-11 items-center gap-1.5 rounded-full bg-white pl-4 pr-3 text-[13px] font-semibold text-ink shadow-float transition-[scale] duration-150 ease-out-strong active:scale-[0.95] can-hover:hidden"
            >
              Sizes
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onAdd(p)}
              aria-label={addLabel}
              className={`absolute inset-x-3 bottom-3 hidden h-11 items-center justify-center gap-2 rounded-full text-[13.5px] font-semibold text-white shadow-float transition-[translate,opacity,scale,background-color] duration-300 ease-out-strong active:scale-[0.97] can-hover:flex can-hover:translate-y-[calc(100%+1rem)] can-hover:opacity-0 can-hover:group-hover:translate-y-0 can-hover:group-hover:opacity-100 can-hover:group-focus-within:translate-y-0 can-hover:group-focus-within:opacity-100 ${justAdded ? "bg-emerald-600" : "bg-ink hover:bg-brand"}`}
            >
              {justAdded
                ? <><Check className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />Added</>
                : <><Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />Add to cart</>}
            </button>
            <button
              type="button"
              onClick={() => onAdd(p)}
              aria-label={addLabel}
              className={`absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full text-white shadow-float transition-[scale,background-color] duration-200 ease-out-strong active:scale-[0.92] can-hover:hidden ${justAdded ? "bg-emerald-600" : "bg-ink"}`}
            >
              {justAdded
                ? <Check className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
                : <Plus className="h-5 w-5" strokeWidth={2} aria-hidden="true" />}
            </button>
          </>
        ))}
      </Tilt>

      {/* Copy */}
      <div className="flex flex-1 flex-col pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <Link to={href} className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-ink transition-colors group-hover:text-brand line-clamp-2">
              {p.name}
            </h3>
          </Link>
          <p className="shrink-0 pt-px text-right font-display text-[15.5px] font-semibold leading-snug tabular-nums tracking-tight text-ink">
            {hasVariants && <span className="font-sans text-[11px] font-medium text-stone-500">From </span>}
            {money(p.price)}
            {offPct && <s className="ml-1.5 font-sans text-[12px] font-normal text-stone-400">{money(p.mrp)}</s>}
          </p>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="truncate text-[13px] text-stone-500">{benefit}</p>
          {Number(gstPercent) > 0 && <span className="shrink-0 text-[10.5px] text-stone-400">excl. GST</span>}
        </div>
        <div className="mt-2 flex h-4 items-center">
          {p.reviewCount > 0 && <Stars rating={p.avgRating} count={p.reviewCount} />}
        </div>
      </div>
    </article>
  );
});

export default ProductCard;

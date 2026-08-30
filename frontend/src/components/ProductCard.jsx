/**
 * ProductCard.jsx — Catalogue product card used by Shop and Home.
 *
 * Lives here rather than inside Shop.jsx so that Home can render a product
 * without statically importing the whole Shop page — that import defeated
 * Shop's lazy route split and pulled it into the initial bundle.
 *
 * @param {{ p: object, onAdd: Function, justAdded: boolean, gstPercent: number }} props
 * @module components/ProductCard
 */
import React from "react";
import { Link } from "react-router-dom";
import { money } from "../utils/format";

export function Stars({ rating, count }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`text-[13px] leading-none ${i <= Math.round(rating) ? "text-amber-400" : "text-stone-200"}`}>★</span>
      ))}
      <span className="text-[11px] text-stone-400 ml-0.5">{Number(rating).toFixed(1)} ({count})</span>
    </div>
  );
}

const ProductCard = React.memo(function ProductCard({ p, onAdd, justAdded, gstPercent }) {
  const out = (p.stockQty ?? 0) <= 0;
  const desc = String(p.description || "").replace(/\s+/g, " ").trim().slice(0, 110) ||
    "Premium daily supplement with clean ingredients and reliable quality.";

  return (
    <div className="group flex flex-col rounded-2xl border border-[#E8E4DE] bg-white overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_20px_rgba(30,58,95,0.12),0_0_0_1px_rgba(30,58,95,0.08)] hover:border-[#1e3a5f]/20 hover:scale-[1.02] transition-all duration-300 ease-out">

      <Link to={`/product/${p.id}`} className="block relative overflow-hidden bg-stone-50" style={{ height: "220px" }}>
        <img
          src={p.image}
          alt={p.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          style={{ objectPosition: p.imagePosition || "50% 50%" }}
          loading="lazy"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {/* Category */}
        {p.category && (
          <div className="absolute top-3 left-3">
            <span className="rounded-full bg-white border border-[#E8E4DE] px-2.5 py-1 text-[10px] font-semibold text-stone-600 shadow-sm">
              {p.category}
            </span>
          </div>
        )}
        {/* Stock */}
        <div className="absolute top-3 right-3">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold border ${out ? "bg-red-50 border-red-200 text-red-600" : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}>
            <span className="inline-flex items-center gap-1">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${out ? "bg-red-500" : "bg-emerald-500"}`} />
              {out ? "Out of stock" : "In stock"}
            </span>
          </span>
        </div>
      </Link>

      {/* Body */}
      <div className="flex flex-col flex-1 p-5">

        {/* 1. Name — 2 lines max */}
        <Link to={`/product/${p.id}`}>
          <h3 className="text-[15px] font-semibold text-stone-900 leading-snug line-clamp-2 group-hover:text-[#1e3a5f] transition-colors">
            {p.name}
          </h3>
        </Link>

        {/* 2. Rating — always reserves space so cards stay aligned */}
        <div className="mt-1.5 h-5 flex items-center">
          {p.reviewCount > 0 && <Stars rating={p.avgRating} count={p.reviewCount} />}
        </div>

        {/* 3. Description — 2 lines max */}
        <p className="mt-2 text-[13px] text-stone-500 leading-relaxed line-clamp-2">{desc}</p>

        {/* 4. Highlights — pushed to sit just above price */}
        <div className="mt-auto pt-3 flex flex-wrap gap-1.5">
          {(p.highlights && p.highlights.length > 0
            ? p.highlights.slice(0, 3)
            : ["Clean label", "Lab-tested", "COD available"]
          ).map((tag) => (
            <span key={tag} className="rounded-full border border-[#E8E4DE] bg-stone-50 px-2.5 py-0.5 text-[10px] font-medium text-stone-500">{tag}</span>
          ))}
        </div>

        {/* 5. Price + button */}
        <div className="pt-4">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <span className="text-[11px] text-stone-400 block mb-0.5">
                {p.variants && p.variants.length > 0 ? "Starting from" : "Price"}
              </span>
              <span className="text-lg font-semibold text-stone-900">
                {p.variants && p.variants.length > 0 ? "From " : ""}{money(p.price)}
              </span>
              <span className="text-[10px] text-stone-400 block mt-0.5">
                {Number(gstPercent) > 0 ? "Excl. GST & Shipping" : "Excl. Shipping"}
              </span>
            </div>
            <Link to={`/product/${p.id}`} className="text-[12px] font-semibold text-[#1e3a5f] hover:underline underline-offset-2">
              Details →
            </Link>
          </div>

          {/* Variant hint chips on card */}
          {p.variants && p.variants.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {p.variants.slice(0, 3).map((v) => (
                <span key={v.id} className="rounded-full border border-[#1e3a5f]/20 bg-[#EFF6FF] px-2.5 py-0.5 text-[10px] font-medium text-[#1e3a5f]">
                  {v.label}
                </span>
              ))}
              {p.variants.length > 3 && (
                <span className="rounded-full border border-[#E8E4DE] bg-stone-50 px-2.5 py-0.5 text-[10px] text-stone-400">
                  +{p.variants.length - 3} more
                </span>
              )}
            </div>
          )}

          {p.variants && p.variants.length > 0 ? (
            <Link
              to={`/product/${p.id}`}
              className="btn-primary block w-full text-center"
            >
              Select option →
            </Link>
          ) : (
            <button
              onClick={() => onAdd(p)}
              disabled={out}
              type="button"
              className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold border transition-all duration-200 ${out
                ? "border-stone-200 bg-stone-100 text-stone-400 cursor-not-allowed"
                : justAdded
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "btn-primary"
                }`}
            >
              {justAdded ? "Added to cart ✓" : out ? "Out of stock" : "Add to cart"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default ProductCard;

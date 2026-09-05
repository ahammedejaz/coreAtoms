/**
 * Spotlight.jsx — One formula, large. The first pinned best seller (or the
 * first product in the catalogue) gets the treatment a premium label gives
 * its lead product: the bottle on a bone tile drifting against the scroll,
 * the benefit chips from `best_for`, the highlights, the price and one
 * primary action.
 *
 * @param {{ product: object, gstPercent: number, onAdd: Function, justAdded: boolean }} props
 * @module components/home/Spotlight
 */
import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Star } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import ScrollReveal, { usePrefersReducedMotion } from "../ScrollReveal";
import { money, discountPercent } from "../../utils/format";
import { isOutOfStock } from "../../services/products";

/** "Immunity • Skin health" → ["Immunity", "Skin health"] */
function benefitChips(text) {
  return String(text || "").split(/\s*[•·|,]\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
}

export default function Spotlight({ product, gstPercent, onAdd, justAdded }) {
  const ref = useRef(null);
  const reduceMotion = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], [56, -56]);

  if (!product) return null;

  const hasVariants = (product.variants || []).length > 0;
  const out = isOutOfStock(product);
  const chips = benefitChips(product.bestFor);
  const highlights = (product.highlights || []).slice(0, 4);
  const offPct = discountPercent(product.mrp, product.price);
  const href = `/product/${product.id}`;

  return (
    <section ref={ref} className="py-20 lg:py-28" aria-labelledby="spotlight-heading">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
        <ScrollReveal variant="scale">
          <Link to={href} className="relative block aspect-[4/5] overflow-hidden rounded-[28px] bg-bone" aria-label={`${product.name} details`}>
            <motion.img
              style={reduceMotion ? undefined : { y: imgY }}
              src={product.image}
              alt=""
              className="product-img absolute inset-0 h-full w-full scale-[1.14] object-cover"
              loading="lazy"
            />
            {product.reviewCount > 0 && (
              <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-3 py-1.5 text-[12.5px] font-semibold text-ink backdrop-blur">
                <Star className="h-3.5 w-3.5 text-amber" fill="currentColor" strokeWidth={0} aria-hidden="true" />
                <span className="tabular-nums">{Number(product.avgRating).toFixed(1)}</span>
                <span className="font-medium text-stone-500 tabular-nums">({product.reviewCount})</span>
              </span>
            )}
          </Link>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <div>
            {product.category && (
              <Link to={`/shop?category=${encodeURIComponent(product.category)}`} className="text-[13px] font-semibold text-brand underline-offset-4 hover:underline">
                {product.category}
              </Link>
            )}
            <h2 id="spotlight-heading" className="mt-3 font-display text-4xl font-semibold leading-[1] tracking-[-0.035em] text-ink sm:text-5xl lg:text-[3.6rem]">
              {product.name}
            </h2>
            {chips.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {chips.map((c) => <li key={c} className="pill">{c}</li>)}
              </ul>
            )}
            {product.description && (
              <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-stone-600 line-clamp-3">{product.description}</p>
            )}
            {highlights.length > 0 && (
              <ul className="mt-7 divide-y divide-line border-y border-line">
                {highlights.map((h) => (
                  <li key={h} className="flex items-center gap-3 py-3 text-[14.5px] text-ink">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-soft">
                      <Check className="h-3 w-3 text-amber-deep" strokeWidth={3} aria-hidden="true" />
                    </span>
                    {h}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="font-display text-3xl font-semibold tabular-nums tracking-tight text-ink">
                {hasVariants && <span className="font-sans text-sm font-medium text-stone-500">From </span>}
                {money(product.price)}
              </p>
              {offPct && <s className="text-[15px] text-stone-400 tabular-nums">{money(product.mrp)}</s>}
              {Number(gstPercent) > 0 && <span className="text-xs text-stone-400">excl. GST</span>}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {hasVariants || out ? (
                <Link to={href} className="btn-primary btn-lg">
                  {out ? "View details" : "Choose a size"}
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </Link>
              ) : (
                <button type="button" onClick={() => onAdd(product)} className={`btn-primary btn-lg ${justAdded ? "!bg-emerald-600" : ""}`}>
                  {justAdded
                    ? <><Check className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />Added</>
                    : "Add to cart"}
                </button>
              )}
              <Link to={href} className="btn-secondary btn-lg">Full details</Link>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

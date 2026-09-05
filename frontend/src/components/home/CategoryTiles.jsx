/**
 * CategoryTiles.jsx — "Shop by category" as a strip of square photo tiles,
 * one per admin category (`homepage_categories`), each carrying the live
 * count of formulas in it. A strip rather than a grid so six tiles fill one
 * row on desktop and sixteen scroll without breaking the layout. Under the
 * strip, "Shop by goal" chips derived from every product's `best_for`.
 *
 * Tiles link to the shop filtered by the category's key. When no product
 * carries that key yet (an admin label such as "HSN"), the tile falls back
 * to a search on its label so it never lands on an empty shop.
 *
 * @param {{ categories: Array<{label:string, category:string, image?:string}>, products: Array<object>, goals: Array<{label:string, count:number}> }} props
 * @module components/home/CategoryTiles
 */
import { useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import ScrollReveal, { ScrollRevealGroup } from "../ScrollReveal";
import Tilt from "../fx/Tilt";
import RevealText from "../fx/RevealText";

const norm = (s) => String(s || "").trim().toLowerCase();

export default function CategoryTiles({ categories, products, goals }) {
  const scrollerRef = useRef(null);

  const tiles = useMemo(() => {
    const active = (products || []).filter((p) => p.isActive !== false);
    return (categories || []).map((cat, i) => {
      const key = norm(cat.category);
      const labelKey = norm(cat.label);
      const firstWord = labelKey.split(/[\s&]+/)[0] || "";
      const exact = active.filter((p) => norm(p.category) === key);
      const loose = exact.length
        ? exact
        : active.filter((p) => norm(p.category) === labelKey || norm(p.name).includes(labelKey) || (firstWord.length > 3 && norm(p.category).includes(firstWord)));
      const sample = loose[0];
      return {
        id: `${cat.category || cat.label}-${i}`,
        label: cat.label,
        countText: exact.length > 0 ? `${exact.length} formula${exact.length !== 1 ? "s" : ""}` : "Explore",
        image: cat.image || sample?.image || "",
        imagePosition: cat.image ? "50% 50%" : (sample?.imagePosition || "50% 50%"),
        href: exact.length
          ? `/shop?category=${encodeURIComponent(cat.category)}`
          : `/shop?q=${encodeURIComponent(cat.label)}`,
      };
    });
  }, [categories, products]);

  const nudge = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  if (tiles.length === 0) return null;

  return (
    <section className="py-14 lg:py-20" aria-labelledby="categories-heading">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <ScrollReveal>
          <div className="flex items-end justify-between gap-6">
            <div>
              <RevealText id="categories-heading" text="Shop by category" className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl" />
              <p className="mt-2 text-[15px] text-stone-500">Start from what you need. Every range is fully disclosed on the label.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link to="/shop" className="btn-secondary hidden sm:inline-flex">
                All products
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </Link>
              {tiles.length > 6 && (
                <>
                  <button type="button" onClick={() => nudge(-1)} className="btn-icon ml-2 hidden h-11 w-11 lg:inline-flex" aria-label="Scroll categories left">
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => nudge(1)} className="btn-icon hidden h-11 w-11 lg:inline-flex" aria-label="Scroll categories right">
                    <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>
        </ScrollReveal>

        <div
          ref={scrollerRef}
          className="no-scrollbar -mx-5 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 scroll-px-5 sm:-mx-6 sm:px-6 sm:scroll-px-6"
        >
          <ScrollRevealGroup stagger={50} className="w-[41vw] shrink-0 snap-start sm:w-[27vw] lg:w-[calc((100%-5rem)/6)]">
            {tiles.map((t) => (
              <Link key={t.id} to={t.href} className="group block" data-cursor="View">
                <Tilt as="span" className="block aspect-square overflow-hidden rounded-tile bg-bone">
                  {t.image && (
                    <img
                      src={t.image}
                      alt=""
                      loading="lazy"
                      className="product-img h-full w-full object-cover transition-transform duration-700 ease-out-strong can-hover:group-hover:scale-[1.06]"
                      style={{ objectPosition: t.imagePosition }}
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white text-ink opacity-0 shadow-float transition-[opacity,translate] duration-300 ease-out-strong translate-y-1 can-hover:group-hover:translate-y-0 can-hover:group-hover:opacity-100"
                  >
                    <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                </Tilt>
                <span className="mt-3 block text-[15px] font-semibold leading-snug text-ink transition-colors group-hover:text-brand">{t.label}</span>
                <span className="mt-0.5 block text-[12.5px] text-stone-500 tabular-nums">{t.countText}</span>
              </Link>
            ))}
          </ScrollRevealGroup>
        </div>

        {goals?.length > 0 && (
          <ScrollReveal delay={80}>
            <div className="mt-8 flex flex-col gap-3 border-t border-line pt-7 sm:flex-row sm:items-center sm:gap-6">
              <p className="shrink-0 text-[13.5px] font-semibold text-ink">Shop by goal</p>
              <ul className="flex flex-wrap gap-2">
                {goals.map((g) => (
                  <li key={g.label}>
                    <Link
                      to={`/shop?q=${encodeURIComponent(g.label)}`}
                      className="inline-flex items-center rounded-full border border-line-strong bg-white px-4 py-2 text-[13.5px] font-medium text-ink transition-[background-color,border-color] duration-150 ease-out-strong hover:border-ink hover:bg-bone"
                    >
                      {g.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        )}

        <Link to="/shop" className="btn-secondary mt-6 w-full sm:hidden">
          All products
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

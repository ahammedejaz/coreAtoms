/**
 * CategoryIndex.jsx — "Find your formula" as a typographic index: one large
 * row per admin category (`homepage_categories`), the live count of formulas
 * in it, and a photograph of a product from that range that floats in beside
 * the row under the pointer. On touch the photograph sits inline as a small
 * thumbnail instead.
 *
 * Rows link to the shop filtered by the category's key. When no product
 * carries that key yet (an admin label such as "HSN"), the row falls back to
 * a search on its label so it never lands on an empty shop.
 *
 * @param {{ categories: Array<{label:string, category:string, image?:string}>, products: Array<object> }} props
 * @module components/home/CategoryIndex
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import ScrollReveal from "../ScrollReveal";

const norm = (s) => String(s || "").trim().toLowerCase();

function Thumb({ src, alt = "", className = "" }) {
  if (!src) return null;
  return <img src={src} alt={alt} loading="lazy" className={`product-img h-full w-full object-cover ${className}`} />;
}

export default function CategoryIndex({ categories, products }) {
  const rows = useMemo(() => {
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
      const href = exact.length
        ? `/shop?category=${encodeURIComponent(cat.category)}`
        : `/shop?q=${encodeURIComponent(cat.label)}`;
      return {
        id: `${cat.category || cat.label}-${i}`,
        label: cat.label,
        count: exact.length,
        countText: exact.length > 0 ? `${exact.length} formula${exact.length !== 1 ? "s" : ""}` : "Explore",
        image: cat.image || sample?.image || "",
        imagePosition: cat.image ? "50% 50%" : (sample?.imagePosition || "50% 50%"),
        href,
      };
    });
  }, [categories, products]);

  if (rows.length === 0) return null;

  return (
    <section className="border-t border-line py-20 lg:py-28" aria-labelledby="formula-heading">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <ScrollReveal>
          <div className="flex items-end justify-between gap-6">
            <div>
              <h2 id="formula-heading" className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl">Find your formula</h2>
              <p className="mt-2 text-[15px] text-stone-500">Start from what you need. Every range is fully disclosed on the label.</p>
            </div>
            <Link to="/shop" className="hidden items-center gap-1.5 text-sm font-semibold text-brand underline-offset-4 hover:underline sm:inline-flex">
              All products
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </ScrollReveal>

        <ul className="mt-10 lg:mt-12">
          {rows.map((row, i) => (
            <ScrollReveal as="li" key={row.id} delay={i * 40} className="group relative border-t border-line last:border-b hover:z-20">
              <Link to={row.href} className="flex items-center gap-4 py-5 sm:gap-6 sm:py-6 lg:py-7">
                {/* Touch: inline thumbnail */}
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-bone sm:h-16 sm:w-16 lg:hidden" aria-hidden="true">
                  <Thumb src={row.image} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[1.6rem] font-semibold leading-[1.02] tracking-[-0.035em] text-ink transition-transform duration-300 ease-out-strong sm:text-[2.6rem] sm:leading-none lg:text-[3.4rem] can-hover:group-hover:translate-x-3">
                    {row.label}
                  </span>
                  {/* Phones: the count sits under the label so a long name never collides with it. */}
                  <span className="mt-1.5 block text-[12.5px] text-stone-500 tabular-nums sm:hidden">{row.countText}</span>
                </span>
                <span className="flex shrink-0 items-center gap-4 sm:gap-6">
                  <span className="hidden text-[14px] text-stone-500 tabular-nums sm:inline">{row.countText}</span>
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-line-strong text-ink transition-[background-color,color,border-color,transform] duration-300 ease-out-strong group-hover:border-ink group-hover:bg-ink group-hover:text-white sm:h-11 sm:w-11">
                    <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                </span>
              </Link>

              {/* Pointer: floating photograph */}
              {row.image && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-[26%] top-1/2 z-10 hidden aspect-[4/5] w-40 -translate-y-1/2 rotate-[-5deg] scale-90 overflow-hidden rounded-2xl bg-bone opacity-0 shadow-lift-lg transition-[opacity,scale,rotate] duration-400 ease-out-strong can-hover:group-hover:rotate-0 can-hover:group-hover:scale-100 can-hover:group-hover:opacity-100 lg:block"
                >
                  <Thumb src={row.image} className="scale-[1.08]" />
                </span>
              )}
            </ScrollReveal>
          ))}
        </ul>

        <Link to="/shop" className="btn-secondary mt-8 w-full sm:hidden">
          All products
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

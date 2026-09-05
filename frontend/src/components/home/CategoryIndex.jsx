/**
 * CategoryIndex.jsx — "Shop by category" as an index: one hairline row per
 * admin category (`homepage_categories`) with a numeral, the name set large,
 * the live count of formulas in it and what they are taken for. On desktop
 * a stage beside the list shows the hovered category's jar, lifted off its
 * photograph onto a navy field, so the list is browsed by looking rather than
 * by clicking. Under the index, "Shop by goal" chips derived from every
 * product's `best_for`.
 *
 * Rows link to the shop filtered by the category's key. When no product
 * carries that key yet (an admin label such as "HSN"), the row falls back to
 * a search on its label so it never lands on an empty shop.
 *
 * @param {{ categories: Array<{label:string, category:string, image?:string}>, products: Array<object>, goals: Array<{label:string, count:number}>, heading?: string, intro?: string }} props
 * @module components/home/CategoryIndex
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import ScrollReveal from "../ScrollReveal";
import RevealText from "../fx/RevealText";
import Cutout from "../Cutout";
import useCutout from "../../hooks/useCutout";
import { getCutout } from "../../utils/cutout";
import { useMotion } from "../../context/MotionContext";

const norm = (s) => String(s || "").trim().toLowerCase();

function splitBestFor(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value || "").split(/[,|/]+/).map((v) => v.trim()).filter(Boolean);
}

export default function CategoryIndex({
  categories,
  products,
  goals,
  heading = "Shop by category",
  intro = "Start from what you need. Every range is fully disclosed on the label.",
}) {
  const { stage } = useMotion();
  const [active, setActive] = useState(0);
  const [displayed, setDisplayed] = useState(0);

  const rows = useMemo(() => {
    const live = (products || []).filter((p) => p.isActive !== false);
    return (categories || []).map((cat, i) => {
      const key = norm(cat.category);
      const labelKey = norm(cat.label);
      const firstWord = labelKey.split(/[\s&]+/)[0] || "";
      const exact = live.filter((p) => norm(p.category) === key);
      const loose = exact.length
        ? exact
        : live.filter((p) => norm(p.category) === labelKey || norm(p.name).includes(labelKey) || (firstWord.length > 3 && norm(p.category).includes(firstWord)));
      const sample = loose.find((p) => p.image) || loose[0];
      const tags = [];
      loose.forEach((p) => splitBestFor(p.bestFor).forEach((t) => { if (!tags.some((x) => norm(x) === norm(t))) tags.push(t); }));
      return {
        id: `${cat.category || cat.label}-${i}`,
        label: cat.label,
        count: exact.length,
        countText: exact.length > 0 ? `${exact.length} formula${exact.length !== 1 ? "s" : ""}` : "Explore the range",
        tags: tags.slice(0, 3),
        image: cat.image || sample?.image || "",
        sampleName: sample?.name || "",
        href: exact.length
          ? `/shop?category=${encodeURIComponent(cat.category)}`
          : `/shop?q=${encodeURIComponent(cat.label)}`,
      };
    });
  }, [categories, products]);

  // The stage only swaps once the hovered category's jar is ready, so it is
  // never empty; the rows themselves highlight at once. On desktop every
  // jar is prepared shortly after the section mounts.
  const target = rows[Math.min(active, rows.length - 1)];
  const cut = useCutout(target?.image);
  useEffect(() => {
    if (!target?.image || cut.status === "ready" || cut.status === "failed") setDisplayed(active);
  }, [active, cut.status, target?.image]);
  useEffect(() => {
    if (!stage) return undefined;
    const t = setTimeout(() => rows.forEach((r) => { if (r.image) getCutout(r.image); }), 800);
    return () => clearTimeout(t);
  }, [rows, stage]);

  if (rows.length === 0) return null;
  const shown = rows[Math.min(displayed, rows.length - 1)];

  return (
    <section className="py-14 lg:py-24" aria-labelledby="categories-heading">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <ScrollReveal>
          <div className="flex items-end justify-between gap-6">
            <div>
              <RevealText id="categories-heading" text={heading} className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl" />
              <p className="mt-2 max-w-lg text-[15px] text-stone-500">{intro}</p>
            </div>
            <Link to="/shop" className="btn-secondary hidden shrink-0 sm:inline-flex">
              All products
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </ScrollReveal>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-16">
          <ScrollReveal as="ol" className="border-t border-line">
            {rows.map((r, i) => (
              <li key={r.id} className="border-b border-line">
                <Link
                  to={r.href}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  className={`group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 py-5 transition-colors duration-300 sm:gap-6 lg:py-6 ${i === active ? "text-ink" : "text-ink lg:text-stone-500"}`}
                >
                  <span className="font-display text-[15px] font-medium tabular-nums text-stone-400">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0">
                    <span className={`block font-display text-[1.75rem] font-semibold leading-none tracking-[-0.03em] transition-transform duration-500 ease-out-strong sm:text-[2.25rem] ${i === active ? "lg:translate-x-2" : ""}`}>
                      {r.label}
                    </span>
                    <span className="mt-2 block truncate text-[13.5px] text-stone-500">
                      <span className="tabular-nums">{r.countText}</span>
                      {r.tags.length > 0 && <span className="text-stone-400"> · {r.tags.join(", ")}</span>}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`grid h-11 w-11 place-items-center rounded-full border transition-[background-color,border-color,color,transform] duration-300 ease-out-strong ${i === active ? "border-ink bg-ink text-white lg:-rotate-0" : "border-line-strong text-ink lg:-rotate-45"}`}
                  >
                    <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                </Link>
              </li>
            ))}
          </ScrollReveal>

          {/* The stage: the hovered category's jar on a navy field. */}
          <ScrollReveal delay={120} className="hidden lg:block">
            <div className="field-navy grain stage-field relative aspect-[4/5] overflow-hidden rounded-[28px] shadow-frame">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={shown.id}
                  initial={{ opacity: 0, y: 36, rotate: -5, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -24, scale: 0.97 }}
                  transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute inset-x-[8%] bottom-[18%] top-[8%] z-[1] flex items-center justify-center"
                >
                  {shown.image ? (
                    <Cutout
                      src={shown.image}
                      alt=""
                      className="hero-float max-h-full w-auto max-w-full object-contain"
                      fallback={<img src={shown.image} alt="" className="h-full w-full rounded-[20px] object-cover" />}
                    />
                  ) : (
                    <span className="font-display text-[7rem] font-semibold leading-none tracking-[-0.06em] text-white/12">{String(displayed + 1).padStart(2, "0")}</span>
                  )}
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-x-0 bottom-0 z-[2] flex items-end justify-between gap-4 p-7 text-white">
                <div className="min-w-0">
                  <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-white/55">{shown.countText}</p>
                  <p className="mt-1 truncate font-display text-2xl font-semibold tracking-[-0.03em]">{shown.label}</p>
                  {shown.sampleName && <p className="mt-0.5 truncate text-[13px] text-white/60">Including {shown.sampleName}</p>}
                </div>
                <Link to={shown.href} className="btn-inverse shrink-0">
                  Shop
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>

        {goals?.length > 0 && (
          <ScrollReveal delay={80}>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
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

/**
 * IngredientIndex.jsx — "What's inside": the actives across the catalogue
 * (see `buildIngredientIndex` in services/homepage.js), each with what it is
 * known for and the number of formulas that carry it, as a bordered grid in
 * the Supplement-Facts grammar. Every cell links to the shop search for that
 * active. When the count does not fill the last row, a filler cell carries
 * the "all formulas" action so the grid always closes cleanly.
 *
 * @param {{ items: Array<{name:string, role:string, count:number, href:string}>, total: number }} props
 * @module components/home/IngredientIndex
 */
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import ScrollReveal from "../ScrollReveal";
import RevealText from "../fx/RevealText";

/* Literal class tables so Tailwind can see every variant. Keyed by how many
   empty cells the last row has at each breakpoint (2, 3 and 4 columns). */
const FILL = {
  base: { 0: "hidden", 1: "col-span-1" },
  sm: { 0: "sm:hidden", 1: "sm:block sm:col-span-1", 2: "sm:block sm:col-span-2" },
  lg: { 0: "lg:hidden", 1: "lg:block lg:col-span-1", 2: "lg:block lg:col-span-2", 3: "lg:block lg:col-span-3" },
};
const gap = (n, cols) => (cols - (n % cols)) % cols;

export default function IngredientIndex({ items, total, heading = "What's inside", intro = "The actives across the range, what each is known for, and how many formulas carry it." }) {
  const rows = items || [];
  if (rows.length === 0) return null;
  const fillerClass = `${FILL.base[gap(rows.length, 2)]} ${FILL.sm[gap(rows.length, 3)]} ${FILL.lg[gap(rows.length, 4)]}`;
  const showFiller = gap(rows.length, 2) + gap(rows.length, 3) + gap(rows.length, 4) > 0;

  return (
    <section className="py-14 lg:py-20" aria-labelledby="inside-heading">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <ScrollReveal>
          <div className="flex items-end justify-between gap-6">
            <div>
              <RevealText id="inside-heading" text={heading} className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl" />
              <p className="mt-2 max-w-xl text-[15px] text-stone-500">{intro}</p>
            </div>
            <Link to="/shop" className="hidden items-center gap-1.5 text-sm font-semibold text-brand underline-offset-4 hover:underline sm:inline-flex">
              All products
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </ScrollReveal>

        <ul className="mt-8 grid grid-cols-2 border-l border-t border-line sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((it, i) => (
            <ScrollReveal as="li" key={it.name} delay={(i % 4) * 50} className="border-b border-r border-line">
              <Link to={it.href} className="group flex h-full flex-col p-4 transition-colors duration-200 hover:bg-white sm:p-5">
                <span className="font-display text-[1.15rem] font-semibold leading-tight tracking-tight text-ink sm:text-[1.3rem]">{it.name}</span>
                <span className="mt-2 flex-1 text-[13px] leading-relaxed text-stone-600">{it.role}</span>
                <span className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand">
                  <span className="tabular-nums">{it.count}</span> formula{it.count !== 1 ? "s" : ""}
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 ease-out-strong group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.75} aria-hidden="true" />
                </span>
              </Link>
            </ScrollReveal>
          ))}
          {showFiller && (
            <li className={`border-b border-r border-line bg-bone ${fillerClass}`}>
              <div className="flex h-full flex-col items-start justify-center gap-3 p-5">
                <p className="text-[14px] leading-snug text-stone-600">
                  {total > 0 ? `${total} formulas, every ingredient on the label.` : "Every ingredient on the label."}
                </p>
                <Link to="/shop" className="btn-primary btn-sm">
                  Browse all
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                </Link>
              </div>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

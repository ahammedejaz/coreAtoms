/**
 * Routine.jsx — "Build your routine": morning, midday and night columns of
 * the formulas the labels name for each time of day (see `buildRoutine` in
 * services/homepage.js). Each row is a compact product line with its own
 * add button, so a visitor can assemble a day's stack without leaving the
 * page. White panels on the bone field; hairline rows inside.
 *
 * @param {{ slots: Array<{key:string, title:string, note:string, products:Array<object>}>, onAdd: Function, justAddedId: string|null }} props
 * @module components/home/Routine
 */
import { Link } from "react-router-dom";
import { ArrowRight, Check, Moon, Plus, Sun, Sunrise } from "lucide-react";
import ScrollReveal from "../ScrollReveal";
import { money } from "../../utils/format";
import { isOutOfStock } from "../../services/products";

const ICONS = { morning: Sunrise, midday: Sun, night: Moon };

/** "Immunity • Skin health" → "Immunity, Skin health" */
function benefitLine(p) {
  return String(p?.bestFor || "").split(/\s*[•·|,]\s*/).filter(Boolean).join(", ") || p?.category || "";
}

function Row({ p, onAdd, justAdded }) {
  const hasVariants = (p.variants || []).length > 0;
  const out = isOutOfStock(p);
  const href = `/product/${p.id}`;
  return (
    <li className="flex items-center gap-4 py-3.5">
      <Link to={href} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-bone" tabIndex={-1} aria-hidden="true">
        {p.image && (
          <img src={p.image} alt="" loading="lazy" className="product-img h-full w-full object-cover" style={{ objectPosition: p.imagePosition || "50% 50%" }} />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={href} className="block truncate text-[14.5px] font-semibold leading-snug text-ink transition-colors hover:text-brand">{p.name}</Link>
        <p className="mt-0.5 truncate text-[12.5px] text-stone-500">{benefitLine(p)}</p>
        <p className="mt-1 font-display text-[14px] font-semibold tabular-nums tracking-tight text-ink">
          {hasVariants && <span className="font-sans text-[11px] font-medium text-stone-500">From </span>}
          {money(p.price)}
        </p>
      </div>
      {out ? (
        <span className="pill shrink-0">Sold out</span>
      ) : hasVariants ? (
        <Link to={href} className="btn-icon h-10 w-10 shrink-0" aria-label={`Choose a size for ${p.name}`}>
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => onAdd(p)}
          aria-label={justAdded ? `${p.name} added` : `Add ${p.name} to cart`}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition-[scale,background-color] duration-200 ease-out-strong active:scale-[0.92] ${justAdded ? "bg-emerald-600" : "bg-ink hover:bg-brand"}`}
        >
          {justAdded
            ? <Check className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
            : <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
        </button>
      )}
    </li>
  );
}

export default function Routine({ slots, onAdd, justAddedId }) {
  const shown = (slots || []).filter((s) => s.products.length > 0);
  if (shown.length === 0) return null;
  const cols = shown.length === 1 ? "grid-cols-1 max-w-xl" : shown.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <section id="routine" className="scroll-mt-24 bg-bone py-14 lg:py-20" aria-labelledby="routine-heading">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <ScrollReveal>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="routine-heading" className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl">Build your routine</h2>
              <p className="mt-2 max-w-xl text-[15px] text-stone-600">
                Each label names what it pairs well with and when to take it. Put a morning, midday and night together from those pairings; consistency does more than any single formula.
              </p>
            </div>
            <Link to="/shop" className="btn-secondary hidden shrink-0 sm:inline-flex">
              Shop the full range
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </ScrollReveal>

        <div className={`mt-8 grid items-start gap-4 lg:gap-5 ${cols}`}>
          {shown.map((slot, i) => {
            const Icon = ICONS[slot.key] || Sun;
            return (
              <ScrollReveal key={slot.key} delay={i * 90} className="panel px-5 pb-2 pt-5 sm:px-6">
                <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-bone text-brand">
                      <Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-display text-xl font-semibold tracking-tight text-ink">{slot.title}</p>
                      <p className="text-[12.5px] text-stone-500">{slot.note}</p>
                    </div>
                  </div>
                  <span className="text-[12.5px] text-stone-500 tabular-nums">
                    {slot.products.length} formula{slot.products.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <ul className="divide-y divide-line">
                  {slot.products.map((p) => (
                    <Row key={p.id} p={p} onAdd={onAdd} justAdded={justAddedId === p.id} />
                  ))}
                </ul>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

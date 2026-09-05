/**
 * Routine.jsx — "When to take what": the range's daily schedule, drawn as
 * one Supplement-Facts table (`.facts`) rather than product cards. Each row
 * is a time of day: the slot on the left, one sentence on why those
 * nutrients suit that hour, and the formulas the labels name for it (see
 * `buildRoutine` in services/homepage.js) as text-only lines with a price
 * and an add button. No thumbnails: the copy is the content here, and a
 * short row (one formula at midday) reads as a short row, not an empty
 * card.
 *
 * @param {{ slots: Array<{key:string, title:string, note:string, why:string, products:Array<object>}>, onAdd: Function, justAddedId: string|null }} props
 * @module components/home/Routine
 */
import { Link } from "react-router-dom";
import { ArrowRight, Check, Moon, Plus, Sun, Sunrise } from "lucide-react";
import ScrollReveal from "../ScrollReveal";
import RevealText from "../fx/RevealText";
import { money } from "../../utils/format";
import { isOutOfStock } from "../../services/products";

const ICONS = { morning: Sunrise, midday: Sun, night: Moon };

/** Slot | why | formulas. Shared by the header row and every body row. */
const COLS = "lg:grid-cols-[10.5rem_minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-x-10";

function Row({ p, onAdd, justAdded }) {
  const hasVariants = (p.variants || []).length > 0;
  const out = isOutOfStock(p);
  const href = `/product/${p.id}`;
  return (
    <li className="flex items-center gap-3 py-2">
      <Link to={href} className="min-w-0 flex-1 truncate text-[14.5px] font-semibold leading-snug text-ink transition-colors hover:text-brand">
        {p.name}
      </Link>
      <span className="shrink-0 font-display text-[14px] font-semibold tabular-nums tracking-tight text-ink">
        {hasVariants && <span className="font-sans text-[11px] font-medium text-stone-500">From </span>}
        {money(p.price)}
      </span>
      {out ? (
        <span className="w-8 shrink-0 text-center text-[11px] font-medium leading-tight text-stone-500">Sold<br />out</span>
      ) : hasVariants ? (
        <Link
          to={href}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line-strong text-ink transition-colors hover:border-ink hover:bg-bone"
          aria-label={`Choose a size for ${p.name}`}
        >
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => onAdd(p)}
          aria-label={justAdded ? `${p.name} added` : `Add ${p.name} to cart`}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-white transition-[scale,background-color] duration-200 ease-out-strong active:scale-[0.92] ${justAdded ? "bg-emerald-600" : "bg-ink hover:bg-brand"}`}
        >
          {justAdded
            ? <Check className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
            : <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
        </button>
      )}
    </li>
  );
}

export default function Routine({ slots, onAdd, justAddedId }) {
  const shown = (slots || []).filter((s) => s.products.length > 0);
  if (shown.length === 0) return null;

  return (
    <section id="routine" className="scroll-mt-24 bg-bone py-14 lg:py-20" aria-labelledby="routine-heading">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <ScrollReveal>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <RevealText id="routine-heading" text="When to take what" className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl" />
              <p className="mt-2 max-w-xl text-[15px] text-stone-600">
                Every label carries a pairing note: what a formula goes with and when. Read together, they give the range a daily schedule from breakfast to bedtime.
              </p>
            </div>
            <Link to="/shop" className="btn-secondary hidden shrink-0 sm:inline-flex">
              Shop the full range
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={80} className="facts mt-8 px-5 pb-1 pt-5 sm:px-7 sm:pt-6">
          <div className="facts-title flex items-end justify-between gap-4">
            <span>Daily schedule</span>
            <span className="hidden font-sans text-[12.5px] font-medium tracking-normal text-stone-500 tabular-nums sm:block">
              {shown.reduce((n, s) => n + s.products.length, 0)} formulas
            </span>
          </div>
          <div className={`facts-sub grid ${COLS}`}>
            <span className="lg:hidden">Morning to night, with meals</span>
            <span className="hidden lg:block">Time of day</span>
            <span className="hidden lg:block">Why then</span>
            <span className="hidden lg:block">Formulas</span>
          </div>

          <ol>
            {shown.map((slot) => {
              const Icon = ICONS[slot.key] || Sun;
              return (
                <li key={slot.key} className={`grid gap-y-3 border-b border-line py-5 last:border-b-0 lg:py-6 ${COLS}`}>
                  <div className="flex items-center gap-3 lg:self-start">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bone text-brand">
                      <Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-display text-xl font-semibold leading-tight tracking-tight text-ink">{slot.title}</p>
                      <p className="text-[12.5px] text-stone-500">{slot.note}</p>
                    </div>
                  </div>
                  <p className="max-w-md text-[14px] leading-relaxed text-stone-600">{slot.why}</p>
                  <ul className="divide-y divide-line lg:-my-2">
                    {slot.products.map((p) => (
                      <Row key={p.id} p={p} onAdd={onAdd} justAdded={justAddedId === p.id} />
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>

          <p className="facts-foot">
            Timings are general guidance drawn from each label's pairing notes, not medical advice. Follow the directions on your pack, and ask a doctor first if you are pregnant, nursing or taking medication.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}

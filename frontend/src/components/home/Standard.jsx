/**
 * Standard.jsx — "The Formulary standard": the rules every formula is held
 * to (`DEFAULT_STANDARDS`, or the `homepage_standards` setting when saved).
 *
 * On desktop it is a pinned story. A navy card stays put on the left while
 * the six rules scroll past on the right. The card carries the current
 * rule's numeral, set large and flush with the text column, a progress line
 * of one segment per rule, and an index of the rules whose numerals sit in
 * one aligned column; as each rule reaches the middle of the screen it comes
 * to full ink on the right and ticks off on the card. On phones and tablets
 * the rules are the plain hairline list.
 *
 * @param {{ items: Array<{icon?:string, title:string, text:string}>, heading?: string, intro?: string }} props
 * @module components/home/Standard
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BadgeCheck, Check, ClipboardCheck, FlaskConical, Scale, ShieldCheck, Truck } from "lucide-react";
import ScrollReveal from "../ScrollReveal";
import HintIcon from "../HintIcon";
import RevealText from "../fx/RevealText";

const ICONS = { form: FlaskConical, dose: Scale, blend: ClipboardCheck, test: ShieldCheck, dispatch: Truck, claims: BadgeCheck };

function RuleIcon({ it, className = "h-5 w-5" }) {
  const Icon = ICONS[it.icon];
  return Icon
    ? <Icon className={className} strokeWidth={1.6} aria-hidden="true" />
    : <HintIcon hint={it.title} className={className} strokeWidth={1.6} />;
}

/** Desktop: the pinned panel and the scrolling rules. */
function Story({ rows }) {
  const [active, setActive] = useState(0);
  const stepRefs = useRef([]);

  useEffect(() => {
    const els = stepRefs.current.filter(Boolean);
    if (els.length === 0) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) setActive(Number(e.target.dataset.index));
      });
    }, { rootMargin: "-42% 0px -42% 0px", threshold: 0 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [rows.length]);

  const pad = (n) => String(n).padStart(2, "0");
  const current = rows[active] || rows[0];

  return (
    <div className="hidden lg:grid lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
      <div className="lg:sticky lg:top-32 lg:self-start">
        <div className="field-navy grain relative overflow-hidden rounded-[28px] shadow-frame">
          <div className="relative z-[1] p-9">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">The Formulary standard</p>
              <p className="font-display text-[15px] font-semibold tabular-nums text-white/45">
                <span className="text-white">{pad(active + 1)}</span>
                <span className="mx-1.5">/</span>
                {pad(rows.length)}
              </p>
            </div>

            <div className="mt-8 flex items-end justify-between gap-6">
              <div className="relative h-[6.5rem] flex-1 overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={active}
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -22 }}
                    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                    className="absolute inset-x-0 bottom-0 font-display text-[6.5rem] font-semibold leading-[0.85] tracking-[-0.06em] text-white tabular-nums"
                    aria-hidden="true"
                  >
                    {pad(active + 1)}
                  </motion.p>
                </AnimatePresence>
              </div>
              <span className="mb-1 grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-amber">
                <RuleIcon it={current} className="h-5 w-5" />
              </span>
            </div>

            <div className="mt-7 flex gap-1.5" aria-hidden="true">
              {rows.map((it, i) => (
                <span key={`${it.title}-${i}`} className={`h-[3px] flex-1 rounded-full transition-colors duration-500 ${i <= active ? "bg-amber" : "bg-white/15"}`} />
              ))}
            </div>

            <ol className="mt-8 border-t border-white/10">
              {rows.map((it, i) => {
                const now = i === active;
                const done = i < active;
                return (
                  <li
                    key={`${it.title}-${i}`}
                    className={`flex items-center gap-4 border-b border-white/10 py-3.5 text-[14.5px] transition-colors duration-500 ${now ? "text-white" : done ? "text-white/70" : "text-white/35"}`}
                  >
                    <span className={`w-7 shrink-0 font-display text-[13px] font-semibold tabular-nums ${now ? "text-amber" : ""}`}>{pad(i + 1)}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{it.title}</span>
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors duration-500 ${now ? "bg-amber text-ink" : done ? "bg-white/15 text-white" : "border border-white/15 text-transparent"}`}>
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-5 text-[12.5px] text-white/50">Written into every label, checked on every batch.</p>
          </div>
        </div>
      </div>

      <ol className="py-[10vh]">
        {rows.map((it, i) => (
          <li
            key={`${it.title}-${i}`}
            ref={(el) => { stepRefs.current[i] = el; }}
            data-index={i}
            className={`flex min-h-[34vh] items-start gap-6 border-t border-line py-9 transition-opacity duration-500 ease-out-strong ${i === active ? "opacity-100" : "opacity-35"}`}
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-bone text-brand">
              <RuleIcon it={it} className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-ink">{it.title}</p>
              <p className="mt-3 max-w-md text-[16px] leading-relaxed text-stone-600">{it.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Phones and tablets: the hairline list. */
function List({ rows }) {
  return (
    <ol className="grid border-t border-line sm:grid-cols-2 lg:hidden">
      {rows.map((it, i) => (
        <ScrollReveal
          as="li"
          key={`${it.title}-${i}`}
          delay={i * 60}
          className={`flex gap-4 border-b border-line py-6 ${i % 2 === 1 ? "sm:border-l sm:pl-6" : "sm:pr-6"}`}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bone text-brand">
            <RuleIcon it={it} />
          </span>
          <div className="min-w-0">
            <p className="text-[16px] font-semibold leading-snug text-ink">{it.title}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-stone-600">{it.text}</p>
          </div>
        </ScrollReveal>
      ))}
    </ol>
  );
}

export default function Standard({ items, heading = "The Formulary standard", intro = "Six rules every Core Atoms formula is held to, from the form of each nutrient to the words we use to describe it." }) {
  const rows = (items || []).filter((it) => it?.title).slice(0, 8);
  if (rows.length === 0) return null;

  return (
    <section className="border-y border-line bg-white py-14 lg:py-24" aria-labelledby="standard-heading">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <ScrollReveal>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <RevealText id="standard-heading" text={heading} className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl" />
              <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-stone-600">{intro}</p>
            </div>
            <Link to="/faq" className="btn-secondary hidden shrink-0 sm:inline-flex">
              How we work, in detail
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </ScrollReveal>
        <div className="mt-10 lg:mt-14">
          <Story rows={rows} />
          <List rows={rows} />
        </div>
      </div>
    </section>
  );
}

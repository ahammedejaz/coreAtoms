/**
 * Standard.jsx — "The Formulary standard": the rules every formula is held
 * to (`DEFAULT_STANDARDS`, or the `homepage_standards` setting when saved).
 *
 * On desktop it is a pinned story. A Supplement-Facts panel stays put on
 * the left while the six rules scroll past on the right; as each rule
 * reaches the middle of the screen it comes to full ink and its row on the
 * panel fills in, so by the end the label has assembled itself. On phones
 * and tablets the rules are the plain hairline list.
 *
 * @param {{ items: Array<{icon?:string, title:string, text:string}>, heading?: string, intro?: string }} props
 * @module components/home/Standard
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
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

  return (
    <div className="hidden lg:grid lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
      <div className="lg:sticky lg:top-32 lg:self-start">
        <div className="facts relative px-7 pb-2 pt-6">
          <span className="pointer-events-none absolute -right-3 -top-9 font-display text-[7.5rem] font-semibold leading-none tracking-[-0.06em] text-line-strong" aria-hidden="true">
            {String(active + 1).padStart(2, "0")}
          </span>
          <p className="facts-title">Formulary standard</p>
          <p className="facts-sub">{rows.length} rules, every formula</p>
          <ol>
            {rows.map((it, i) => {
              const done = i <= active;
              return (
                <li
                  key={`${it.title}-${i}`}
                  className={`facts-row items-center transition-[opacity,color] duration-500 ease-out-strong ${done ? "opacity-100" : "opacity-30"}`}
                >
                  <span className="flex items-center gap-3">
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors duration-500 ${i === active ? "bg-amber text-ink" : done ? "bg-ink text-white" : "bg-bone text-stone-400"}`}>
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span className="font-semibold text-ink">{it.title}</span>
                  </span>
                  <span className="facts-val text-[13px] text-stone-500">{String(i + 1).padStart(2, "0")}</span>
                </li>
              );
            })}
          </ol>
          <p className="facts-foot">Written into every label, checked on every batch.</p>
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

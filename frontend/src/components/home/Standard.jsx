/**
 * Standard.jsx — "The Formulary standard": the rules every formula is held
 * to (`DEFAULT_STANDARDS`, or the `homepage_standards` setting when saved).
 * A sticky heading on the left, six hairline rows in two columns on the
 * right, each with one lucide icon. Dense on purpose: this is the section
 * that answers "why buy from you" for a visitor comparing stores.
 *
 * @param {{ items: Array<{icon?:string, title:string, text:string}> }} props
 * @module components/home/Standard
 */
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, ClipboardCheck, FlaskConical, Scale, ShieldCheck, Truck } from "lucide-react";
import ScrollReveal from "../ScrollReveal";
import HintIcon from "../HintIcon";

const ICONS = { form: FlaskConical, dose: Scale, blend: ClipboardCheck, test: ShieldCheck, dispatch: Truck, claims: BadgeCheck };

export default function Standard({ items }) {
  const rows = (items || []).filter((it) => it?.title).slice(0, 8);
  if (rows.length === 0) return null;

  return (
    <section className="border-y border-line bg-white py-14 lg:py-20" aria-labelledby="standard-heading">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <ScrollReveal>
          <div className="lg:sticky lg:top-36">
            <h2 id="standard-heading" className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl">The Formulary standard</h2>
            <p className="mt-4 max-w-md text-[16px] leading-relaxed text-stone-600">
              Six rules every Core Atoms formula is held to, from the form of each nutrient to the words we use to describe it.
            </p>
            <Link to="/faq" className="btn-secondary mt-7">
              How we work, in detail
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </ScrollReveal>

        <ol className="grid border-t border-line sm:grid-cols-2">
          {rows.map((it, i) => {
            const Icon = ICONS[it.icon];
            return (
              <ScrollReveal
                as="li"
                key={`${it.title}-${i}`}
                delay={i * 60}
                className={`flex gap-4 border-b border-line py-6 ${i % 2 === 1 ? "sm:border-l sm:pl-6" : "sm:pr-6"}`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bone text-brand">
                  {Icon
                    ? <Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
                    : <HintIcon hint={it.title} className="h-5 w-5" strokeWidth={1.6} />}
                </span>
                <div className="min-w-0">
                  <p className="text-[16px] font-semibold leading-snug text-ink">{it.title}</p>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-stone-600">{it.text}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

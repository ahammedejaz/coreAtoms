/**
 * Education.jsx — "Know your supplements": four short pieces a first-time
 * buyer should understand before buying a supplement from anyone
 * (`DEFAULT_EDUCATION`, or the `homepage_education` setting when saved).
 * White panels on the bone field, one lucide icon each, each with a link
 * into the FAQ or the shop.
 *
 * @param {{ cards: Array<{icon?:string, title:string, text:string, href?:string, linkText?:string}>, heading?: string, intro?: string }} props
 * @module components/home/Education
 */
import { Link } from "react-router-dom";
import { ArrowRight, Beaker, BookOpen, Clock, Microscope } from "lucide-react";
import ScrollReveal from "../ScrollReveal";
import RevealText from "../fx/RevealText";
import HintIcon from "../HintIcon";

const ICONS = { label: BookOpen, form: Beaker, timing: Clock, testing: Microscope };

function CardLink({ href, children, className }) {
  if (!href) return null;
  if (href.startsWith("#")) return <a href={href} className={className}>{children}</a>;
  return <Link to={href} className={className}>{children}</Link>;
}

export default function Education({ cards, heading = "Know your supplements", intro = "Four things worth understanding before you buy a supplement, from us or anyone else." }) {
  const rows = (cards || []).filter((c) => c?.title).slice(0, 4);
  if (rows.length === 0) return null;

  return (
    <section className="bg-bone py-14 lg:py-20" aria-labelledby="learn-heading">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <ScrollReveal>
          <div className="flex items-end justify-between gap-6">
            <div>
              <RevealText id="learn-heading" text={heading} className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl" />
              <p className="mt-2 max-w-xl text-[15px] text-stone-600">{intro}</p>
            </div>
            <Link to="/faq" className="btn-secondary hidden shrink-0 sm:inline-flex">
              Read the FAQ
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </ScrollReveal>

        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((c, i) => {
            const Icon = ICONS[c.icon];
            return (
              <ScrollReveal as="li" key={`${c.title}-${i}`} delay={i * 70} className="panel flex flex-col p-6">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-bone text-brand">
                  {Icon
                    ? <Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
                    : <HintIcon hint={c.title} className="h-5 w-5" strokeWidth={1.6} />}
                </span>
                <h3 className="mt-5 text-[17px] font-semibold leading-snug text-ink">{c.title}</h3>
                <p className="mt-2.5 flex-1 text-[14px] leading-relaxed text-stone-600">{c.text}</p>
                <CardLink href={c.href} className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand underline-offset-4 hover:underline">
                  {c.linkText || "Read more"}
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                </CardLink>
              </ScrollReveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

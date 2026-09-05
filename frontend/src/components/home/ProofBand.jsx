/**
 * ProofBand.jsx — The navy proof field: the `homepage_why_us` heading and
 * body, its call to action, and the four stats as large display numerals
 * that count up the first time they scroll into view. A stat whose value is
 * not a plain number ("3rd party", "Pan-India") simply renders as written.
 *
 * @param {{ whyUs: { heading: string, body: string, cta: string, stats: Array<{value:string, label:string}> } }} props
 * @module components/home/ProofBand
 */
import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { animate, useInView } from "motion/react";
import ScrollReveal, { usePrefersReducedMotion } from "../ScrollReveal";

/**
 * "100%" → { prefix: "", n: 100, suffix: "%" }; "24 hrs" → n: 24, suffix " hrs".
 * Returns null when the number is glued to letters ("3rd"), since counting
 * "0rd, 1rd, 2rd" would read as a bug.
 */
function parseStat(value) {
  const m = String(value ?? "").match(/^([^\d]*?)(\d[\d,]*)(\.\d+)?(.*)$/);
  if (!m) return null;
  const [, prefix, intPart, dec, suffix] = m;
  if (/^[A-Za-z]/.test(suffix)) return null;
  const decimals = dec ? dec.length - 1 : 0;
  return {
    prefix,
    suffix,
    decimals,
    grouped: intPart.includes(","),
    n: Number(intPart.replace(/,/g, "") + (dec || "")),
  };
}

function formatStat(v, { decimals, grouped }) {
  const fixed = decimals ? v.toFixed(decimals) : String(Math.round(v));
  if (!grouped) return fixed;
  const [i, d] = fixed.split(".");
  return Number(i).toLocaleString("en-IN") + (d ? `.${d}` : "");
}

function Stat({ value, label, index }) {
  const ref = useRef(null);
  const numRef = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduceMotion = usePrefersReducedMotion();
  const parsed = useMemo(() => parseStat(value), [value]);

  useEffect(() => {
    if (!inView || !parsed || reduceMotion || !numRef.current) return;
    const el = numRef.current;
    const controls = animate(0, parsed.n, {
      duration: 1.6,
      delay: index * 0.12,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (v) => { el.textContent = formatStat(v, parsed); },
    });
    return () => controls.stop();
  }, [inView, parsed, reduceMotion, index]);

  return (
    <li ref={ref} className={`flex flex-col justify-end ${index > 0 ? "lg:border-l lg:border-white/15 lg:pl-8" : ""} ${index % 2 === 1 ? "border-l border-white/15 pl-6 lg:pl-8" : ""}`}>
      {/* Numerals run large; a worded value ("3rd party", "Pan-India") is set
          a step smaller so it stays on one line beside them. */}
      <span
        className={`block font-display font-semibold tracking-[-0.04em] text-white ${
          parsed
            ? "text-[2.75rem] leading-none tabular-nums sm:text-6xl"
            : "text-[2rem] leading-[1.05] sm:text-[2.6rem]"
        }`}
      >
        {parsed ? (
          <>
            {parsed.prefix}
            <span ref={numRef}>{formatStat(reduceMotion ? parsed.n : 0, parsed)}</span>
            {parsed.suffix}
          </>
        ) : value}
      </span>
      <span className="mt-3 block max-w-[18ch] text-[14px] leading-snug text-white/65">{label}</span>
    </li>
  );
}

export default function ProofBand({ whyUs }) {
  const stats = (whyUs?.stats || []).slice(0, 4);

  return (
    <section className="field-navy grain overflow-hidden py-20 lg:py-24" aria-labelledby="proof-heading">
      <div className="relative z-[1] mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end lg:gap-16">
          <ScrollReveal>
            <h2 id="proof-heading" className="font-display text-4xl font-semibold leading-[0.98] tracking-[-0.035em] text-white sm:text-5xl lg:text-6xl">
              {whyUs.heading}
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <div>
              <p className="max-w-lg text-[17px] leading-relaxed text-white/75">{whyUs.body}</p>
              <Link to="/shop" className="btn-inverse btn-lg mt-8">
                {whyUs.cta}
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </div>
          </ScrollReveal>
        </div>

        {stats.length > 0 && (
          <ul className="mt-12 grid grid-cols-2 gap-y-10 border-t border-white/15 pt-10 lg:mt-14 lg:grid-cols-4 lg:gap-x-8 lg:pt-12">
            {stats.map((s, i) => <Stat key={`${s.label}-${i}`} value={s.value} label={s.label} index={i} />)}
          </ul>
        )}
      </div>
    </section>
  );
}

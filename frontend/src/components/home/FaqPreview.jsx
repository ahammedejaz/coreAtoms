/**
 * FaqPreview.jsx — "Questions, answered": the handful of FAQ entries a
 * first-time visitor asks before buying (`HOME_FAQS` in content/faqs.js),
 * as the same accordion the FAQ page uses, with a sticky heading and a link
 * to the full page. The answers are the same objects the FAQ page renders,
 * so there is one place to keep them true.
 *
 * @param {{ faqs: Array<{q:string, a:string}> }} props
 * @module components/home/FaqPreview
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import ScrollReveal from "../ScrollReveal";
import RevealText from "../fx/RevealText";
import FaqItem from "../FaqItem";

export default function FaqPreview({ faqs }) {
  const [openIndex, setOpenIndex] = useState(0);
  const rows = faqs || [];
  if (rows.length === 0) return null;

  return (
    <section className="border-y border-line bg-white py-14 lg:py-20" aria-labelledby="faq-heading">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <ScrollReveal>
          <div className="lg:sticky lg:top-36">
            <RevealText id="faq-heading" text="Questions, answered" className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl" />
            <p className="mt-4 max-w-md text-[16px] leading-relaxed text-stone-600">
              Ordering, delivery, replacements, and what our products are and are not.
            </p>
            <Link to="/faq" className="btn-secondary mt-7">
              All questions
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <div className="divide-y divide-line border-y border-line">
            {rows.map((f, i) => (
              <FaqItem
                key={f.q}
                q={f.q}
                a={f.a}
                open={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

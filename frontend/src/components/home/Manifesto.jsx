/**
 * Manifesto.jsx — The closing statement (`homepage_philosophy`). The heading
 * and body are revealed one word at a time as the visitor scrolls them into
 * the middle of the viewport, each word brightening from a faint ink to full,
 * then the call to action rises.
 *
 * @param {{ philosophy: { heading: string, body: string, cta: string } }} props
 * @module components/home/Manifesto
 */
import { Fragment, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import ScrollReveal, { usePrefersReducedMotion } from "../ScrollReveal";

function Word({ progress, index, total, min, children }) {
  const start = index / total;
  const end = start + 1 / total;
  const opacity = useTransform(progress, [start, end], [min, 1]);
  return <motion.span style={{ opacity }} className="inline-block">{children}</motion.span>;
}

/**
 * Renders `text` word by word, brightening each in turn between `start`
 * (fraction of the viewport where the block enters) and `end` (where the
 * reveal completes). Newlines in the text become line breaks.
 */
function ScrollWords({ text, as: Tag = "p", className = "", start = 0.92, end = 0.5, min = 0.14 }) {
  const ref = useRef(null);
  const reduceMotion = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: [`start ${start}`, `end ${end}`] });

  const lines = String(text || "").split("\n");
  const total = lines.reduce((n, line) => n + line.split(/\s+/).filter(Boolean).length, 0) || 1;

  if (reduceMotion) {
    return <Tag className={`${className} whitespace-pre-line`}>{text}</Tag>;
  }

  let index = 0;
  return (
    <Tag ref={ref} className={className}>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split(/\s+/).filter(Boolean).map((w, wi) => {
            const i = index++;
            return (
              <Fragment key={`${li}-${wi}`}>
                {wi > 0 && " "}
                <Word progress={scrollYProgress} index={i} total={total} min={min}>{w}</Word>
              </Fragment>
            );
          })}
        </Fragment>
      ))}
    </Tag>
  );
}

export default function Manifesto({ philosophy }) {
  return (
    <section className="border-t border-line py-24 lg:py-40" aria-labelledby="manifesto-heading">
      <div className="mx-auto max-w-4xl px-5 text-center sm:px-6">
        <ScrollWords
          as="h2"
          text={philosophy.heading}
          className="font-display text-[2.6rem] font-semibold leading-[0.98] tracking-[-0.04em] text-ink sm:text-6xl lg:text-[5rem]"
        />
        <ScrollWords
          as="p"
          text={philosophy.body}
          className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-ink sm:text-[21px]"
          start={0.9}
          end={0.45}
          min={0.18}
        />
        <ScrollReveal className="mt-10">
          <Link to="/shop" className="btn-primary btn-lg">
            {philosophy.cta || "Explore the range"}
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}

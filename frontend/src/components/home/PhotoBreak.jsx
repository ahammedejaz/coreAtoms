/**
 * PhotoBreak.jsx — A full-bleed photograph between sections. It arrives
 * as a rounded frame and grows to the full width of the page as it
 * scrolls in, the picture drifting slower than the page beneath a navy
 * scrim, with one line of display type over it. Photographs come from the
 * hero slides the admin has already uploaded; the copy is editable.
 *
 * @param {{ image: { url: string, position?: string }, text: string, sub?: string, align?: "left"|"center" }} props
 * @module components/home/PhotoBreak
 */
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import RevealText from "../fx/RevealText";
import { usePrefersReducedMotion } from "../ScrollReveal";

export default function PhotoBreak({ image, text, sub, align = "left" }) {
  const ref = useRef(null);
  const reduceMotion = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);
  const clip = useTransform(scrollYProgress, [0, 0.32], ["inset(6% 4% 6% 4% round 28px)", "inset(0% 0% 0% 0% round 0px)"]);

  if (!image?.url || !text) return null;

  return (
    <section ref={ref} className="relative isolate h-[62svh] min-h-[420px] overflow-hidden bg-navy-950 text-white" aria-label={text}>
      <motion.div style={reduceMotion ? undefined : { clipPath: clip }} className="absolute inset-0">
        <motion.img
          src={image.url}
          alt=""
          style={reduceMotion ? { objectPosition: image.position || "50% 50%" } : { y, objectPosition: image.position || "50% 50%" }}
          className="absolute inset-x-0 -top-[14%] h-[128%] w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,19,42,0.25),rgba(8,19,42,0.62))]" aria-hidden="true" />
      </motion.div>
      <div className={`relative z-[1] mx-auto flex h-full max-w-6xl flex-col justify-end px-5 pb-12 sm:px-6 lg:pb-16 ${align === "center" ? "items-center text-center" : ""}`}>
        <RevealText as="p" text={text} className="max-w-[16ch] font-display text-[2.4rem] font-semibold leading-[0.98] tracking-[-0.035em] text-bone sm:text-6xl lg:text-[4.5rem]" />
        {sub && <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75 sm:text-[17px]">{sub}</p>}
      </div>
    </section>
  );
}

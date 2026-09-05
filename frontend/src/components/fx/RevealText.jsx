/**
 * RevealText.jsx — A heading whose words rise out of a mask, one after
 * another, the first time it scrolls into view. The same reveal the hero
 * headline uses on load, made available to every page title and section
 * heading. Under reduced motion it renders plain text.
 *
 * @param {{ as?: string, text: string, className?: string, delay?: number, step?: number, accent?: string, id?: string }} props
 * @module components/fx/RevealText
 */
import { Fragment, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../ScrollReveal";

export default function RevealText({ as: Tag = "h2", text, accent = "", className = "", delay = 0, step = 45, ...rest }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); io.disconnect(); }
    }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [reduceMotion]);

  if (reduceMotion) {
    return <Tag className={className} {...rest}>{text}{accent ? <> <span className="text-amber">{accent}</span></> : null}</Tag>;
  }

  const words = String(text || "").split(/\s+/).filter(Boolean);
  const accentWords = String(accent || "").split(/\s+/).filter(Boolean);
  let i = 0;
  const render = (list, cls) => list.map((w, k) => {
    const n = i++;
    return (
      <Fragment key={`${cls}-${k}`}>
        {k > 0 && " "}
        <span className={`word-mask ${cls}`}>
          <span style={{ "--delay": `${delay + n * step}ms` }}>{w}</span>
        </span>
      </Fragment>
    );
  });

  return (
    <Tag ref={ref} className={`reveal-words ${inView ? "is-in" : ""} ${className}`} {...rest}>
      {render(words, "")}
      {accentWords.length > 0 && " "}
      {render(accentWords, "text-amber")}
    </Tag>
  );
}

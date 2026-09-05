/**
 * Hero.jsx — The home page's first viewport.
 *
 * Full-bleed lifestyle photography from `homepage_hero_images` sits under a
 * navy scrim; one slide shows at a time with a slow push-in and a crossfade
 * every six seconds. The headline reveals word by word from a mask, then the
 * body, the two pills and the trust points rise in turn. On scroll the copy
 * drifts down and fades while the photograph moves at a slower rate.
 *
 * On desktop the lead formula's real jar stands in the right third, lifted
 * off its studio backdrop (`components/Cutout`) so it floats over the
 * photograph with its own shadow. It rises into place, breathes on a slow
 * float, leans a few degrees toward the pointer, and drifts at its own rate
 * as the page scrolls. A caption under it links straight to the formula.
 * When the cutout cannot be made and there are no photographs, the plain
 * photo stands on a bone tile instead. While settings are still loading the
 * hero is the navy field alone, so nothing flashes in front of a photograph
 * that is about to arrive.
 *
 * @param {{ images: Array<{url:string, position:string}>|null, copy: object, trust: Array<{label:string}>, leadProduct?: object }} props
 * @module components/home/Hero
 */
import { Fragment, useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import HintIcon from "../HintIcon";
import Cutout from "../Cutout";
import { usePrefersReducedMotion } from "../ScrollReveal";
import { money } from "../../utils/format";
import Magnetic from "../fx/Magnetic";
import { useMotion } from "../../context/MotionContext";

const SLIDE_INTERVAL_MS = 6000;

/** Splits text into words, each revealed from its own mask in sequence. */
function MaskWords({ text, className = "", startDelay = 80, step = 55, offset = 0 }) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  return words.map((w, i) => (
    <Fragment key={`${w}-${i}`}>
      {i > 0 && " "}
      <span className={`word-mask ${className}`}>
        <span style={{ "--delay": `${startDelay + (offset + i) * step}ms` }}>{w}</span>
      </span>
    </Fragment>
  ));
}

/** The jar leans toward wherever the pointer is over the hero. */
function usePointerLean(sectionRef, targetRef, enabled, max = 7) {
  useEffect(() => {
    if (!enabled) return undefined;
    const section = sectionRef.current;
    const el = targetRef.current;
    if (!section || !el) return undefined;
    let raf = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    const paint = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      el.style.transform = `perspective(1400px) rotateX(${cy.toFixed(2)}deg) rotateY(${cx.toFixed(2)}deg)`;
      if (Math.abs(tx - cx) > 0.02 || Math.abs(ty - cy) > 0.02) raf = requestAnimationFrame(paint);
      else raf = 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const onMove = (e) => {
      const r = section.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2 * max;
      ty = -((e.clientY - r.top) / r.height - 0.5) * 2 * max * 0.6;
      kick();
    };
    const onLeave = () => { tx = 0; ty = 0; kick(); };
    section.addEventListener("pointermove", onMove, { passive: true });
    section.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      el.style.transform = "";
    };
  }, [sectionRef, targetRef, enabled, max]);
}

function ProductTile({ product }) {
  return (
    <Link
      to={`/product/${product.id}`}
      className="animate-rise block w-[78%] max-w-[420px] overflow-hidden rounded-[28px] bg-bone shadow-frame [animation-delay:400ms]"
    >
      <div className="aspect-[4/5]">
        <img
          src={product.image}
          alt={product.name}
          className="product-img h-full w-full object-cover"
          style={{ objectPosition: product.imagePosition || "50% 50%" }}
          loading="eager"
          fetchPriority="high"
        />
      </div>
      <div className="flex items-center justify-between gap-3 bg-white px-5 py-3.5 text-ink">
        <span className="truncate text-sm font-semibold">{product.name}</span>
        <span className="font-display font-semibold tabular-nums">{money(product.price)}</span>
      </div>
    </Link>
  );
}

export default function Hero({ images, copy, trust, leadProduct }) {
  const ref = useRef(null);
  const leanRef = useRef(null);
  const reduceMotion = usePrefersReducedMotion();
  const { tilt } = useMotion();
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const [broken, setBroken] = useState({});
  const [loaded, setLoaded] = useState({});
  const [jarReady, setJarReady] = useState(false);
  const markJarReady = useCallback(() => setJarReady(true), []);

  const pending = images === null;
  const slides = useMemo(() => (images || []).filter((s) => s.url && !broken[s.url]), [images, broken]);
  const hasSlides = slides.length > 0;
  const current = hasSlides ? index % slides.length : 0;

  useEffect(() => {
    if (slides.length <= 1 || reduceMotion) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [slides.length, tick, reduceMotion]);

  const goTo = useCallback((i) => {
    setIndex(i);
    setTick((t) => t + 1);
  }, []);

  const markLoaded = useCallback((url) => {
    setLoaded((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
  }, []);

  const markBroken = useCallback((url) => {
    setBroken((prev) => ({ ...prev, [url]: true }));
  }, []);

  // Scroll-linked drift: the photograph moves at a slower rate than the page,
  // the copy sinks and fades, and the jar drifts at a third rate.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const jarY = useTransform(scrollYProgress, [0, 1], [0, 110]);
  const jarOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  const showJar = !pending && Boolean(leadProduct?.image);
  usePointerLean(ref, leanRef, showJar && jarReady && tilt && !reduceMotion);

  const headlineWords = String(copy.headline || "").split(/\s+/).filter(Boolean).length;
  const priceText = leadProduct?.variants?.length > 0 ? `From ${money(leadProduct.price)}` : money(leadProduct?.price);

  return (
    <section ref={ref} className="relative isolate flex min-h-[88svh] flex-col overflow-hidden bg-navy-950 text-white">
      {/* Backdrop */}
      <motion.div
        style={reduceMotion ? undefined : { y: bgY }}
        className="absolute inset-x-0 -bottom-[12%] -top-[12%] -z-10"
        aria-hidden="true"
      >
        {hasSlides ? (
          slides.map((s, i) => (
            <div key={s.url} className={`hero-slide ${i === current && loaded[s.url] ? "is-active" : ""}`}>
              <img
                src={s.url}
                alt=""
                style={{ objectPosition: s.position || "50% 50%" }}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                decoding="async"
                onLoad={() => markLoaded(s.url)}
                onError={() => markBroken(s.url)}
              />
            </div>
          ))
        ) : (
          <div className="field-navy grain absolute inset-0" />
        )}
      </motion.div>

      {/* Scrim: legible copy on the left, the photograph kept on the right,
          and a fade to navy at the foot where the pillars panel overlaps. */}
      {hasSlides && (
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,19,42,0.94)_0%,rgba(8,19,42,0.74)_40%,rgba(8,19,42,0.3)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-[linear-gradient(180deg,transparent,rgba(8,19,42,0.9))]" />
        </div>
      )}

      {/* The real jar, on desktop. */}
      {showJar && (
        <motion.div
          style={reduceMotion ? undefined : { y: jarY, opacity: jarOpacity }}
          className="pointer-events-none absolute inset-y-[5%] right-[2%] hidden w-[40%] max-w-[580px] lg:flex lg:flex-col lg:items-center lg:justify-center"
        >
          {jarReady && (
            <div className="hero-glow pointer-events-none absolute inset-[6%] rounded-full" aria-hidden="true" />
          )}
          <div ref={leanRef} className="relative flex h-full w-full items-center justify-center will-change-transform [transform-style:preserve-3d]">
            <div className={`hero-float flex h-full w-full items-center justify-center ${jarReady ? "" : "invisible"}`}>
              <Cutout
                src={leadProduct.image}
                alt={leadProduct.name}
                onReady={markJarReady}
                className="hero-jar-enter max-h-full w-auto max-w-full object-contain"
                fallback={hasSlides ? null : <ProductTile product={leadProduct} />}
              />
            </div>
          </div>
          {jarReady && (
            <Link
              to={`/product/${leadProduct.id}`}
              className="animate-rise pointer-events-auto absolute bottom-[6%] left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/15 bg-white/10 py-2 pl-5 pr-2 text-[13.5px] text-white shadow-float backdrop-blur-md transition-colors duration-200 hover:bg-white/16 [animation-delay:1100ms]"
            >
              <span className="text-white/65">Featured</span>
              <span className="font-semibold">{leadProduct.name}</span>
              <span className="text-white/65 tabular-nums">{priceText}</span>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-ink">
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              </span>
            </Link>
          )}
        </motion.div>
      )}

      {/* Copy */}
      <motion.div
        style={reduceMotion ? undefined : { y: copyY, opacity: copyOpacity }}
        className="relative flex flex-1 items-center"
      >
        <div className="mx-auto w-full max-w-6xl px-5 pb-32 pt-16 sm:px-6 sm:pt-20 lg:pb-40 lg:pt-24">
          <h1 className={`font-display text-[2.75rem] font-semibold leading-[0.94] tracking-[-0.04em] sm:text-[4.25rem] lg:text-[5.5rem] ${showJar ? "lg:max-w-[12ch]" : "max-w-[18ch]"}`}>
            <MaskWords text={copy.headline} />
            {" "}
            <MaskWords text={copy.headlineAccent} className="text-amber" offset={headlineWords} />
          </h1>
          <p className="animate-rise mt-7 max-w-lg text-[17px] leading-relaxed text-white/78 [animation-delay:520ms] sm:text-lg">
            {copy.body}
          </p>
          <div className="animate-rise mt-9 flex flex-wrap gap-3 [animation-delay:640ms]">
            <Magnetic>
              <Link to="/shop" className="btn-inverse btn-lg">
                {copy.primaryCta || "Shop all products"}
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </Magnetic>
            <Magnetic>
              <a href="#best-sellers" className="btn-outline-inverse btn-lg">
                {copy.secondaryCta || "View best sellers"}
              </a>
            </Magnetic>
          </div>
          <ul className="animate-rise mt-12 flex flex-wrap gap-x-7 gap-y-3 [animation-delay:760ms]">
            {trust.slice(0, 3).map((t) => (
              <li key={t.label} className="flex items-center gap-2 text-[13.5px] text-white/85">
                <HintIcon hint={t.label} className="h-4 w-4 text-amber" strokeWidth={1.75} />
                {t.label}
              </li>
            ))}
          </ul>

          {slides.length > 1 && (
            <div className="animate-rise mt-10 flex items-center gap-2 [animation-delay:880ms]">
              {slides.map((s, i) => (
                <button
                  key={s.url}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Show photograph ${i + 1} of ${slides.length}`}
                  aria-current={i === current ? "true" : undefined}
                  className={`h-1 rounded-full transition-colors duration-300 ${i === current ? "w-8 bg-amber" : "w-3 bg-white/40 hover:bg-white/75"}`}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </section>
  );
}

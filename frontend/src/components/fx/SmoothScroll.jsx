/**
 * SmoothScroll.jsx — Lenis inertial scrolling for the storefront.
 *
 * Lenis keeps the native scroll position (so Motion's `useScroll`, sticky
 * columns and anchor links all keep working) and only eases the wheel. It
 * is skipped on touch devices, under reduced motion and in the admin, where
 * `useMotion().smoothScroll` is false and the children render untouched.
 *
 * `useScrollLock` is the one way to freeze the page behind a drawer, sheet
 * or dialog: it stops Lenis and sets `overflow: hidden` together, so the
 * two never disagree.
 *
 * @module components/fx/SmoothScroll
 */
import { useCallback, useEffect } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import { useMotion } from "../../context/MotionContext";

const OPTIONS = {
  lerp: 0.1,
  smoothWheel: true,
  wheelMultiplier: 1,
  anchors: { offset: -104 },
  autoRaf: true,
};

export default function SmoothScroll({ children }) {
  const { smoothScroll } = useMotion();
  if (!smoothScroll) return children;
  return <ReactLenis root options={OPTIONS}>{children}</ReactLenis>;
}

/** Freezes page scroll while `locked` is true. */
export function useScrollLock(locked) {
  const lenis = useLenis();
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.classList.add("scroll-locked");
    lenis?.stop();
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.classList.remove("scroll-locked");
      lenis?.start();
    };
  }, [locked, lenis]);
}

/** Jumps to the top instantly, through Lenis when it is running. */
export function useScrollToTop() {
  const lenis = useLenis();
  return useCallback((behavior = "instant") => {
    if (lenis) lenis.scrollTo(0, { immediate: behavior === "instant", force: true });
    else window.scrollTo({ top: 0, left: 0, behavior });
  }, [lenis]);
}

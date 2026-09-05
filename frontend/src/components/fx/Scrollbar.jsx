/**
 * Scrollbar.jsx — The storefront's own scrollbar and reading-progress line.
 *
 * On desktop with a mouse the native scrollbar is hidden (`html.has-rail`)
 * and replaced by a slim ink rail on the right edge: a thumb sized to the
 * page, draggable, that brightens while the page moves and settles to a
 * quiet hairline when it stops. A two-pixel amber line along the top of the
 * viewport shows how far down the page the visitor is. Both are written to
 * the DOM directly from the scroll event, never through React state.
 *
 * @module components/fx/Scrollbar
 */
import { useEffect, useRef } from "react";
import { useLenis } from "lenis/react";
import { useMotion } from "../../context/MotionContext";

const MIN_THUMB = 44;

export default function Scrollbar() {
  const { scrollbar } = useMotion();
  const lenis = useLenis();
  const railRef = useRef(null);
  const thumbRef = useRef(null);
  const lineRef = useRef(null);

  useEffect(() => {
    if (!scrollbar) return;
    const html = document.documentElement;
    html.classList.add("has-rail");

    const rail = railRef.current;
    const thumb = thumbRef.current;
    const line = lineRef.current;
    let idleTimer = null;
    let dragging = false;
    let dragOffset = 0;

    const metrics = () => {
      const max = Math.max(1, html.scrollHeight - window.innerHeight);
      const railH = rail.clientHeight;
      const thumbH = Math.max(MIN_THUMB, Math.round((window.innerHeight / html.scrollHeight) * railH));
      return { max, railH, thumbH };
    };

    const paint = () => {
      const { max, railH, thumbH } = metrics();
      const y = window.scrollY || html.scrollTop;
      const p = Math.min(1, Math.max(0, y / max));
      thumb.style.height = `${thumbH}px`;
      thumb.style.transform = `translateY(${Math.round(p * (railH - thumbH))}px)`;
      line.style.transform = `scaleX(${p})`;
      rail.classList.toggle("is-hidden", html.scrollHeight <= window.innerHeight + 2);
      if (!dragging) {
        rail.classList.add("is-active");
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => rail.classList.remove("is-active"), 900);
      }
    };

    const jumpTo = (clientY) => {
      const { max, railH, thumbH } = metrics();
      const top = rail.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, (clientY - top - dragOffset) / (railH - thumbH)));
      const target = p * max;
      if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
      else window.scrollTo(0, target);
    };

    const onThumbDown = (e) => {
      dragging = true;
      dragOffset = e.clientY - thumb.getBoundingClientRect().top;
      rail.classList.add("is-active", "is-dragging");
      thumb.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onThumbMove = (e) => { if (dragging) jumpTo(e.clientY); };
    const onThumbUp = (e) => {
      if (!dragging) return;
      dragging = false;
      rail.classList.remove("is-dragging");
      try { thumb.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      paint();
    };
    const onRailDown = (e) => {
      if (e.target === thumb) return;
      dragOffset = metrics().thumbH / 2;
      jumpTo(e.clientY);
    };

    thumb.addEventListener("pointerdown", onThumbDown);
    thumb.addEventListener("pointermove", onThumbMove);
    thumb.addEventListener("pointerup", onThumbUp);
    thumb.addEventListener("pointercancel", onThumbUp);
    rail.addEventListener("pointerdown", onRailDown);
    window.addEventListener("scroll", paint, { passive: true });
    window.addEventListener("resize", paint);
    const ro = new ResizeObserver(paint);
    ro.observe(document.body);
    paint();

    return () => {
      html.classList.remove("has-rail");
      clearTimeout(idleTimer);
      thumb.removeEventListener("pointerdown", onThumbDown);
      thumb.removeEventListener("pointermove", onThumbMove);
      thumb.removeEventListener("pointerup", onThumbUp);
      thumb.removeEventListener("pointercancel", onThumbUp);
      rail.removeEventListener("pointerdown", onRailDown);
      window.removeEventListener("scroll", paint);
      window.removeEventListener("resize", paint);
      ro.disconnect();
    };
  }, [scrollbar, lenis]);

  if (!scrollbar) return null;

  return (
    <>
      <div ref={lineRef} className="scroll-line" aria-hidden="true" />
      <div ref={railRef} className="scroll-rail" aria-hidden="true">
        <div ref={thumbRef} className="scroll-thumb" />
      </div>
    </>
  );
}

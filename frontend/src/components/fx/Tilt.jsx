/**
 * Tilt.jsx — A shallow 3D tilt that follows the pointer across a tile,
 * with a soft light that sweeps across the surface, so product and
 * category tiles read as objects with a face rather than flat rectangles.
 * Only on a fine pointer; touch and reduced motion get the plain child,
 * which keeps `position: relative` so the corner controls and badges the
 * tiles place inside it stay anchored to the tile rather than the card.
 *
 * @param {{ children, max?: number, scale?: number, className?: string, as?: string }} props
 * @module components/fx/Tilt
 */
import { useEffect, useRef } from "react";
import { useMotion } from "../../context/MotionContext";

export default function Tilt({ children, max = 7, scale = 1.015, className = "", as: Tag = "div" }) {
  const { tilt } = useMotion();
  const ref = useRef(null);
  const sheenRef = useRef(null);

  useEffect(() => {
    if (!tilt) return;
    const el = ref.current;
    const sheen = sheenRef.current;
    if (!el) return;
    let raf = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0, s = 1, cs = 1, lx = 50, ly = 50;
    let hovering = false;

    const paint = () => {
      cx += (tx - cx) * 0.16;
      cy += (ty - cy) * 0.16;
      cs += (s - cs) * 0.16;
      el.style.transform = `perspective(900px) rotateX(${cy.toFixed(2)}deg) rotateY(${cx.toFixed(2)}deg) scale(${cs.toFixed(3)})`;
      if (sheen) sheen.style.background = `radial-gradient(circle at ${lx}% ${ly}%, rgba(255,255,255,${hovering ? 0.22 : 0}), transparent 55%)`;
      if (hovering || Math.abs(cx) > 0.05 || Math.abs(cy) > 0.05 || Math.abs(cs - 1) > 0.002) raf = requestAnimationFrame(paint);
      else { el.style.transform = ""; raf = 0; }
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(paint); };

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      tx = (px - 0.5) * 2 * max;
      ty = -(py - 0.5) * 2 * max;
      lx = Math.round(px * 100);
      ly = Math.round(py * 100);
      hovering = true;
      s = scale;
      kick();
    };
    const onLeave = () => { hovering = false; tx = 0; ty = 0; s = 1; kick(); };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.style.transform = "";
    };
  }, [tilt, max, scale]);

  if (!tilt) return <Tag className={`relative ${className}`}>{children}</Tag>;
  return (
    <Tag ref={ref} className={`tilt ${className}`}>
      {children}
      <span ref={sheenRef} className="tilt-sheen" aria-hidden="true" />
    </Tag>
  );
}

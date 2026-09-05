/**
 * Magnetic.jsx — A control that leans toward the pointer as it approaches
 * and springs back when it leaves. Reserved for the few primary actions on
 * a page (hero pills, add to cart, checkout); a page full of magnets is a
 * page full of noise. Fine pointers only.
 *
 * @param {{ children, strength?: number, className?: string }} props
 * @module components/fx/Magnetic
 */
import { useEffect, useRef } from "react";
import { useMotion } from "../../context/MotionContext";

export default function Magnetic({ children, strength = 0.32, className = "" }) {
  const { tilt: enabled } = useMotion();
  const ref = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    const wrap = ref.current;
    if (!wrap) return;
    const target = wrap.firstElementChild;
    if (!target) return;
    let raf = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    let active = false;

    const paint = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      target.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
      if (active || Math.abs(cx) > 0.1 || Math.abs(cy) > 0.1) raf = requestAnimationFrame(paint);
      else { target.style.transform = ""; raf = 0; }
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const onMove = (e) => {
      const r = wrap.getBoundingClientRect();
      tx = (e.clientX - (r.left + r.width / 2)) * strength;
      ty = (e.clientY - (r.top + r.height / 2)) * strength;
      active = true;
      kick();
    };
    const onLeave = () => { active = false; tx = 0; ty = 0; kick(); };

    wrap.addEventListener("pointermove", onMove, { passive: true });
    wrap.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      target.style.transform = "";
    };
  }, [enabled, strength]);

  return <span ref={ref} className={`magnetic ${className}`}>{children}</span>;
}

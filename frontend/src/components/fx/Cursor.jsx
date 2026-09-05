/**
 * Cursor.jsx — The storefront pointer on desktop.
 *
 * A small ink dot sits exactly under the pointer and a thin ring follows a
 * beat behind it. Over anything clickable the ring grows; over an element
 * carrying `data-cursor="View"` (product tiles, photographs) it becomes a
 * bone disc with that word inside. Over text fields the OS cursor comes
 * back, because precision matters there and the OS pointer respects the
 * visitor's own accessibility settings. Touch devices, reduced motion and
 * the admin never see it. Everything is driven from one animation frame
 * loop writing transforms, so React is not involved per pointer move.
 *
 * @module components/fx/Cursor
 */
import { useEffect, useRef } from "react";
import { useMotion } from "../../context/MotionContext";

const INTERACTIVE = "a, button, [role='button'], label, summary, select, input[type='checkbox'], input[type='radio'], [data-cursor]";
const NATIVE = "input, textarea, [contenteditable='true'], select, iframe, video";

export default function Cursor() {
  const { cursor } = useMotion();
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const labelRef = useRef(null);

  useEffect(() => {
    if (!cursor) return;
    const html = document.documentElement;
    const dot = dotRef.current;
    const ring = ringRef.current;
    const label = labelRef.current;
    html.classList.add("has-cursor");

    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    let rx = x, ry = y;
    let visible = false;
    let raf = 0;
    let scale = 1;
    let currentScale = 1;

    const tick = () => {
      rx += (x - rx) * 0.22;
      ry += (y - ry) * 0.22;
      currentScale += (scale - currentScale) * 0.2;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) scale(${currentScale.toFixed(3)})`;
      raf = requestAnimationFrame(tick);
    };

    const show = () => {
      if (visible) return;
      visible = true;
      dot.classList.add("is-visible");
      ring.classList.add("is-visible");
    };
    const hide = () => {
      visible = false;
      dot.classList.remove("is-visible");
      ring.classList.remove("is-visible");
    };

    const onMove = (e) => {
      x = e.clientX;
      y = e.clientY;
      show();
    };
    const onOver = (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const nativeHost = t.closest(NATIVE);
      if (nativeHost) {
        dot.classList.add("is-native");
        ring.classList.add("is-native");
        return;
      }
      dot.classList.remove("is-native");
      ring.classList.remove("is-native");

      const labelled = t.closest("[data-cursor]");
      const text = labelled?.getAttribute("data-cursor");
      if (text) {
        label.textContent = text;
        ring.classList.add("is-label");
        dot.classList.add("is-hidden");
        scale = 1;
        return;
      }
      ring.classList.remove("is-label");
      dot.classList.remove("is-hidden");
      scale = t.closest(INTERACTIVE) ? 1.7 : 1;
    };
    const onDown = () => { ring.classList.add("is-down"); };
    const onUp = () => { ring.classList.remove("is-down"); };
    const onLeave = (e) => { if (!e.relatedTarget && !e.toElement) hide(); };
    const onTouch = () => { html.classList.remove("has-cursor"); hide(); };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("mouseout", onLeave);
    window.addEventListener("blur", hide);
    window.addEventListener("touchstart", onTouch, { passive: true, once: true });
    raf = requestAnimationFrame(tick);

    return () => {
      html.classList.remove("has-cursor");
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("mouseout", onLeave);
      window.removeEventListener("blur", hide);
      window.removeEventListener("touchstart", onTouch);
    };
  }, [cursor]);

  if (!cursor) return null;

  return (
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="cursor-ring" aria-hidden="true">
        <span ref={labelRef} className="cursor-label" />
      </div>
    </>
  );
}

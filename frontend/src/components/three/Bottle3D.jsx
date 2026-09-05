/**
 * Bottle3D.jsx — Lazy gate for the 3D scene. Mounts `BottleScene` as its
 * own chunk only when the visit qualifies (`useMotion().hero3d`: desktop,
 * WebGL, no reduced-motion request, admin toggle on) and the host is near
 * the viewport; otherwise renders the `fallback` (or nothing).
 *
 * @param {{ fallback?: React.ReactNode, force?: boolean } & import("./BottleScene").BottleSceneProps} props
 * @module components/three/Bottle3D
 */
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useMotion } from "../../context/MotionContext";

const BottleScene = lazy(() => import("./BottleScene"));

export default function Bottle3D({ fallback = null, className = "", ...props }) {
  const { hero3d } = useMotion();
  const ref = useRef(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (!hero3d) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hero3d]);

  if (!hero3d) return fallback;
  return (
    <div ref={ref} className={className}>
      {near && (
        <Suspense fallback={null}>
          <BottleScene className="h-full w-full" {...props} />
        </Suspense>
      )}
    </div>
  );
}

/**
 * Grain.jsx — A fixed film of fine noise over the whole storefront, so
 * flat bone and white fields read as paper rather than pixels. Pointer
 * events pass through it and it sits below every drawer and dialog.
 *
 * @module components/fx/Grain
 */
import { useMotion } from "../../context/MotionContext";

export default function Grain() {
  const { grain } = useMotion();
  if (!grain) return null;
  return <div className="grain-film" aria-hidden="true" />;
}

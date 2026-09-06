/**
 * Cutout.jsx — A product photograph with its backdrop removed (`utils/cutout`),
 * rendered as a plain `<img>` so it can be sized, transformed and animated
 * like any other. While the cutout is being prepared nothing is drawn; if it
 * cannot be made, `fallback` renders instead (or nothing).
 *
 * @param {{ src: string, alt?: string, className?: string, style?: object, fallback?: React.ReactNode, onReady?: () => void }} props
 * @module components/Cutout
 */
import { useEffect } from "react";
import useCutout from "../hooks/useCutout";

export default function Cutout({ src, alt = "", className = "", style, fallback = null, onReady }) {
  const cut = useCutout(src);
  useEffect(() => { if (cut.status === "ready") onReady?.(); }, [cut.status, onReady]);
  if (cut.status === "failed") return fallback;
  if (cut.status !== "ready") return null;
  return <img src={cut.url} alt={alt} className={className} style={style} draggable={false} decoding="async" />;
}

/**
 * MaskWords.jsx — Splits a line into words and reveals each from its own
 * mask in sequence (`.word-mask` in index.css). Used by the home hero and
 * the account panel for headlines that should arrive word by word on mount.
 *
 * @param {{ text: string, className?: string, startDelay?: number, step?: number, offset?: number }} props
 * @module components/fx/MaskWords
 */
import { Fragment } from "react";

export default function MaskWords({ text, className = "", startDelay = 80, step = 55, offset = 0 }) {
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

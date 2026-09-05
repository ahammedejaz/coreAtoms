/**
 * useCutout.js — The cutout of a product photograph, as state.
 *
 * Returns `{ status: "idle" | "loading" | "ready" | "failed", url?, ratio? }`.
 * A cutout already in the cache is ready on the first render, so a page that
 * has shown this jar once never flashes an empty space for it.
 *
 * @module hooks/useCutout
 */
import { useEffect, useState } from "react";
import { getCutout, peekCutout } from "../utils/cutout";

function fromResult(r) {
  return r ? { status: "ready", ...r } : { status: "failed" };
}

export default function useCutout(src, enabled = true) {
  const [state, setState] = useState(() => {
    if (!src || !enabled) return { status: "idle" };
    const hit = peekCutout(src);
    return hit ? fromResult(hit) : { status: "loading" };
  });

  useEffect(() => {
    if (!src || !enabled) { setState({ status: "idle" }); return undefined; }
    const hit = peekCutout(src);
    if (hit) { setState(fromResult(hit)); return undefined; }
    let on = true;
    setState({ status: "loading" });
    getCutout(src).then((r) => { if (on) setState(fromResult(r)); });
    return () => { on = false; };
  }, [src, enabled]);

  return state;
}

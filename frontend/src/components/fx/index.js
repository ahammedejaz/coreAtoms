/**
 * fx — The storefront's physical layer: smooth scroll, the custom
 * scrollbar and progress line, the pointer, the route curtain, grain,
 * heading reveals, tile tilt and magnetic controls. Every effect reads
 * `useMotion()` and renders nothing when its flag is off.
 *
 * @module components/fx
 */
export { default as SmoothScroll, useScrollLock, useScrollToTop } from "./SmoothScroll";
export { default as Scrollbar } from "./Scrollbar";
export { default as Cursor } from "./Cursor";
export { default as RouteCurtain } from "./RouteCurtain";
export { default as Grain } from "./Grain";
export { default as RevealText } from "./RevealText";
export { default as Tilt } from "./Tilt";
export { default as Magnetic } from "./Magnetic";

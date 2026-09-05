/**
 * sequence.js — The choreography of the bottle, as pure functions of a
 * progress value from 0 to 1, so the same sequence can run on a clock in
 * the hero and be scrubbed by scroll on the product page.
 *
 *   0.00–0.20  the cap unscrews and lifts clear of the neck
 *   0.20–0.32  the cap swings aside and tilts, held in the air
 *   0.28–0.80  tablets pour in one after another and settle in layers
 *   0.80–0.96  the cap swings back over the neck and screws down
 *   0.96–1.00  everything settles
 *
 * Rest positions are generated from a fixed seed, so the fill looks the
 * same on every visit and never needs a physics engine.
 *
 * @module components/three/sequence
 */

export const BODY_HEIGHT = 2.3;
export const BODY_RADIUS = 1;
export const NECK_RADIUS = 0.8;
export const CAP_HEIGHT = 0.58;
export const CAP_RADIUS = 1.04;
/** Tablets rest inside this radius; a little in from the glass. */
const FILL_RADIUS = 0.74;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const span = (p, a, b) => clamp01((p - a) / (b - a));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeInQuad = (t) => t * t;
const easeOutBack = (t) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

/** Deterministic pseudo-random numbers in [0, 1). */
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Where each tablet ends up: layered rings inside the body, each layer a
 * little offset from the last, with a random spin so the pile reads as
 * poured rather than stacked.
 */
export function restPositions(count, seed = 7, gap = 0.22, perLayer = 9, layerHeight = 0.19) {
  const rnd = seeded(seed);
  const out = [];
  let layer = 0;
  while (out.length < count) {
    const y = 0.16 + layer * layerHeight;
    const ring = Math.min(FILL_RADIUS, gap * 2.3);
    const phase = rnd() * Math.PI * 2 + layer * 0.9;
    for (let k = 0; k < perLayer && out.length < count; k++) {
      const centre = k === 0;
      const a = phase + ((k - 1) / (perLayer - 1)) * Math.PI * 2 + (rnd() - 0.5) * 0.3;
      const radius = centre ? rnd() * 0.12 : ring * (0.82 + rnd() * 0.25);
      out.push({
        x: Math.cos(a) * radius,
        y: y + (rnd() - 0.5) * 0.05,
        z: Math.sin(a) * radius,
        rx: (rnd() - 0.5) * 1.1,
        ry: rnd() * Math.PI * 2,
        rz: (rnd() - 0.5) * 1.1,
        spin: (rnd() - 0.5) * 7,
        sx: (rnd() - 0.5) * 0.3,
        sz: (rnd() - 0.5) * 0.3,
        start: 0,
      });
    }
    layer += 1;
  }
  // Stagger by index with a little jitter so the pour reads as a stream.
  out.forEach((p, i) => { p.start = 0.28 + (i / count) * 0.48 + (rnd() - 0.5) * 0.02; });
  return out;
}

/** Cap position and rotation for a progress value. */
export function capPose(p) {
  const restY = BODY_HEIGHT;
  const unscrew = span(p, 0, 0.2);
  const swing = span(p, 0.18, 0.34);
  const back = span(p, 0.8, 0.94);
  const screw = span(p, 0.9, 1);

  // Off: rise a little while turning, then arc up and well to the side.
  const lift = easeOutCubic(unscrew) * 0.34 + easeInOutCubic(swing) * 0.36;
  const side = easeInOutCubic(swing);
  // On: reverse of the swing, then a final quarter turn as it seats.
  const ret = easeInOutCubic(back);
  const seat = easeOutCubic(screw);

  const open = 1 - ret;
  const y = restY + lift * open + (1 - seat) * 0.34 * ret;
  const x = -1.38 * side * open;
  const z = 0.3 * side * open;
  const tiltZ = -0.5 * side * open;
  const tiltX = 0.18 * side * open;
  const spinY = -unscrew * Math.PI * 1.9 * open - (1 - seat) * Math.PI * 0.6 * ret + ret * Math.PI * 2;
  return { x, y, z, rx: tiltX, ry: spinY, rz: tiltZ };
}

/**
 * One tablet's transform for a progress value: hidden before its turn,
 * falling from above the neck with a tumble, then resting.
 * @returns {{x,y,z,rx,ry,rz,scale}}
 */
export function pillPose(rest, p, fallLength = 0.11) {
  const t = span(p, rest.start, rest.start + fallLength);
  if (p < rest.start) return { x: 0, y: 4.2, z: 0, rx: 0, ry: 0, rz: 0, scale: 0 };
  const drop = easeInQuad(t);
  const y = 3.9 - (3.9 - rest.y) * drop;
  const settle = t >= 1 ? 1 : 0;
  const land = span(p, rest.start + fallLength, rest.start + fallLength + 0.05);
  const bounce = settle ? 1 + (1 - easeOutBack(land)) * 0.06 : 1;
  return {
    x: rest.x * Math.min(1, drop * 1.3) + rest.sx * (1 - drop),
    y,
    z: rest.z * Math.min(1, drop * 1.3) + rest.sz * (1 - drop),
    rx: rest.rx + rest.spin * (1 - drop),
    ry: rest.ry,
    rz: rest.rz + rest.spin * 0.6 * (1 - drop),
    scale: bounce,
  };
}

/** Accent colour for the label band, from the product's category. */
export function accentFor(category = "", name = "") {
  const s = `${category} ${name}`.toLowerCase();
  const rules = [
    [/multi/, "#e11d2b"],
    [/bone|calcium|vitamin d/, "#2f8ef5"],
    [/immun|vitamin c|zinc/, "#f59e0b"],
    [/gut|probiotic|digest/, "#16a34a"],
    [/hair|skin|biotin|collagen/, "#ec4899"],
    [/heart|omega/, "#ef4444"],
    [/sleep|magnesium|stress|ashwagandha/, "#6366f1"],
    [/energy|b-complex|b complex/, "#f97316"],
    [/women|iron/, "#db2777"],
    [/inflamm|turmeric|curcumin|joint/, "#d97706"],
  ];
  return (rules.find(([re]) => re.test(s)) || [null, "#1e3a5f"])[1];
}

/** Capsules unless the product says tablets. */
export function formFor(product) {
  const text = `${product?.name || ""} ${(product?.highlights || []).join(" ")} ${product?.description || ""}`.toLowerCase();
  return /tablet/.test(text) ? "tablet" : "capsule";
}

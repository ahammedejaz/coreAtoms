/**
 * cutout.js — Lifts a product photograph off its studio backdrop in the
 * browser, so the real jar can sit on a navy field or float over the hero
 * photograph without a grey rectangle around it.
 *
 * The store's photographs are shot on a flat near-white sweep with a soft
 * ground shadow. From the image border a fill marks the backdrop and the
 * shadow: it walks only along paths on which the distance from the backdrop
 * colour keeps rising (give or take a little) and never jumps. The backdrop
 * is flat and the shadow only deepens toward the product, so both are
 * reached; a nearly white pack panel is not, because getting into it means
 * crossing the pack's edge and coming back down, and a thin bright edge line
 * cannot carry the fill into an enclosed white patch for the same reason. A
 * short second pass then claims the steep pixels hugging the silhouette (the
 * anti-aliased rim and the edge of the contact shadow).
 *
 * Marked pixels become transparent; the ones that were the shadow keep an
 * alpha proportional to how dark they were, which turns the photographed
 * shadow into one that works on any background. Along the silhouette the
 * photograph's edge pixels are a blend of product and backdrop, so they are
 * matted: each gets an alpha from how far it sits from the backdrop colour
 * relative to the product colour just inside it, and the backdrop's share is
 * subtracted from its colour. That removes the pale fringe a plain mask
 * leaves around a dark jar, while a genuinely light panel — as far from the
 * backdrop as anything near it — is left whole.
 *
 * The result is cropped around the product with room for that shadow and
 * returned as an object URL, cached per source URL. Anything that does not
 * look like a studio shot (a dark backdrop, an image the fill would swallow,
 * a cross-origin image the canvas cannot read) resolves to null so callers
 * fall back to the plain photograph.
 *
 * @module utils/cutout
 */

const MAX_WIDTH = 1200;
/** How far (per channel) from the backdrop colour still counts as backdrop or shadow. */
const TOLERANCE = 55;
/** Largest step between neighbouring pixels the flood fill will cross. */
const SMOOTH_STEP = 8;
/** How far the distance may fall back below the highest met along a path. */
const PEAK_SLACK = 4;
/** How far the second pass may reach through steep pixels beside the silhouette. */
const RIM_REACH = 3;
/** Depth of the matted band inside the silhouette, in pixels at 1200 wide. */
const MATTE_DEPTH = 8;
/** Below this ratio of the nearby product colour's distance a pixel is a fringe. */
const FRINGE_RATIO = 0.8;
const REF_MIN = 90;
const SHADOW_RGB = [8, 12, 22];
const SHADOW_ALPHA = 0.85;
/** Distances below this are backdrop noise, not shadow. */
const SHADOW_FLOOR = 8;

const pending = new Map();
const resolved = new Map();

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("image failed"));
    img.src = src;
  });
}

/**
 * Breadth-first walk from the queued seeds through pixels `allow` accepts,
 * marking them with the given value and stopping at `maxDepth`.
 */
function grow(mark, value, queue, tail, w, h, allow, maxDepth, depth) {
  const n = w * h;
  let head = 0;
  const step = (j, dj, i) => {
    if (mark[j] === 0 && allow(j, i)) {
      mark[j] = value;
      if (depth) depth[j] = dj;
      queue[tail++] = j;
    }
  };
  while (head < tail) {
    const i = queue[head++];
    const dj = depth ? depth[i] + 1 : 1;
    if (maxDepth && dj > maxDepth) continue;
    const x = i % w;
    if (x > 0) step(i - 1, dj, i);
    if (x < w - 1) step(i + 1, dj, i);
    if (i >= w) step(i - w, dj, i);
    if (i + w < n) step(i + w, dj, i);
  }
  return tail;
}

/**
 * The pure pixel work: takes straight RGBA and its size, returns the cropped
 * RGBA of the cutout or null. Exported so it can be exercised outside a
 * browser; callers in the app go through `getCutout`.
 *
 * @param {Uint8ClampedArray} d
 * @param {number} w
 * @param {number} h
 * @returns {{ data: Uint8ClampedArray, width: number, height: number, jarX: number } | null}
 */
export function cutoutPixels(d, w, h) {
  const n = w * h;
  const px = w / MAX_WIDTH;

  // Backdrop colour: the average of the four corners.
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
  const bg = [0, 0, 0];
  corners.forEach((o) => { bg[0] += d[o]; bg[1] += d[o + 1]; bg[2] += d[o + 2]; });
  bg[0] /= 4; bg[1] /= 4; bg[2] /= 4;
  if ((bg[0] + bg[1] + bg[2]) / 3 < 200) return null; // not a light studio sweep

  // Distance of every pixel from the backdrop.
  const dist = new Uint8Array(n);
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    const dr = Math.abs(d[o] - bg[0]);
    const dg = Math.abs(d[o + 1] - bg[1]);
    const db = Math.abs(d[o + 2] - bg[2]);
    dist[i] = Math.min(255, Math.max(dr, dg, db));
  }
  // Pass one: from the border, along paths on which the distance from the
  // backdrop never falls back by more than a little from the highest value
  // met so far, and never jumps by more than a step. The backdrop and the
  // shadow satisfy that (the shadow only ever deepens toward the product);
  // a nearly white panel does not, because reaching it means crossing the
  // pack's edge and coming back down, and a thin bright edge line cannot lead
  // into an enclosed white patch for the same reason. Pixels are settled in
  // order of that running peak, so each gets the most permissive path.
  const mark = new Uint8Array(n);
  const peak = new Uint8Array(n).fill(255);
  const buckets = [];
  for (let p = 0; p <= TOLERANCE; p++) buckets.push([]);
  const seed = (i) => { if (dist[i] <= TOLERANCE && peak[i] === 255) { peak[i] = dist[i]; buckets[dist[i]].push(i); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  for (let p = 0; p <= TOLERANCE; p++) {
    const b = buckets[p];
    for (let k = 0; k < b.length; k++) {
      const i = b[k];
      if (mark[i] || peak[i] !== p) continue;
      mark[i] = 1;
      const x = i % w;
      const di = dist[i];
      const relax = (j) => {
        const dj = dist[j];
        if (dj > TOLERANCE || dj < p - PEAK_SLACK || Math.abs(dj - di) > SMOOTH_STEP) return;
        const np = Math.max(p, dj);
        if (np < peak[j]) { peak[j] = np; buckets[np].push(j); }
      };
      if (x > 0) relax(i - 1);
      if (x < w - 1) relax(i + 1);
      if (i >= w) relax(i - w);
      if (i + w < n) relax(i + w);
    }
  }

  // Pass two: a short reach through the steep pixels that hug the
  // silhouette — the anti-aliased rim of the product and the edge of its
  // contact shadow — still only ever moving away from the backdrop colour.
  const queue = new Int32Array(n);
  const depth = new Uint8Array(n);
  let rimTail = 0;
  for (let i = 0; i < n; i++) {
    if (mark[i] !== 1) continue;
    const x = i % w;
    const open = (j) => mark[j] === 0 && dist[j] <= TOLERANCE;
    if ((x > 0 && open(i - 1)) || (x < w - 1 && open(i + 1)) || (i >= w && open(i - w)) || (i + w < n && open(i + w))) {
      queue[rimTail++] = i;
    }
  }
  grow(mark, 2, queue, rimTail, w, h, (j, i) => dist[j] <= TOLERANCE && dist[j] >= dist[i] - PEAK_SLACK, Math.max(2, Math.round(RIM_REACH * px)), depth);

  let filled = 0;
  for (let i = 0; i < n; i++) if (mark[i]) filled++;
  filled /= n;
  if (filled < 0.2 || filled > 0.985) return null;

  // The bounding box of the product itself (the shadow is left out so the
  // product sits centred in the crop).
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let i = 0; i < n; i++) {
    if (mark[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (maxX < 0) return null;
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  if (bw < w * 0.08 || bh < h * 0.15) return null;

  // The matte band: product pixels within MATTE_DEPTH of the backdrop, and
  // backdrop pixels within two of the product. `band` is 1 for the product
  // side and 2 for the backdrop side.
  const band = new Uint8Array(n);
  const bandDepth = new Uint8Array(n);
  let bandTail = 0;
  for (let i = 0; i < n; i++) {
    if (mark[i]) continue;
    const x = i % w;
    if ((x > 0 && mark[i - 1]) || (x < w - 1 && mark[i + 1]) || (i >= w && mark[i - w]) || (i + w < n && mark[i + w])) {
      band[i] = 1;
      bandDepth[i] = 1;
      queue[bandTail++] = i;
    }
  }
  const matteDepth = Math.max(3, Math.round(MATTE_DEPTH * px));
  grow(band, 1, queue, bandTail, w, h, (i) => !mark[i], matteDepth, bandDepth);
  let rimBandTail = 0;
  for (let i = 0; i < n; i++) {
    if (band[i] !== 1 || bandDepth[i] !== 1) continue;
    queue[rimBandTail++] = i;
    bandDepth[i] = 0;
  }
  grow(band, 2, queue, rimBandTail, w, h, (i) => mark[i] > 0, 2, bandDepth);

  // Reference: the furthest-from-backdrop product colour near each band
  // pixel. A pixel well short of it is a blend with the backdrop and gets a
  // proportional alpha and its colour cleaned; one as far as its
  // surroundings is a light panel and stays whole.
  const refRadius = matteDepth + 2;
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!band[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    const x0 = Math.max(0, x - refRadius), x1 = Math.min(w - 1, x + refRadius);
    const y0 = Math.max(0, y - refRadius), y1 = Math.min(h - 1, y + refRadius);
    let ref = 0;
    for (let yy = y0; yy <= y1; yy++) {
      const row = yy * w;
      for (let xx = x0; xx <= x1; xx++) {
        const j = row + xx;
        if (!mark[j] && dist[j] > ref) ref = dist[j];
      }
    }
    const di = dist[i];
    if (band[i] === 1 && di >= ref * FRINGE_RATIO) { alpha[i] = 1; continue; }
    alpha[i] = Math.min(1, di / Math.max(ref, REF_MIN));
  }

  // Compose: transparent backdrop, shadow as alpha, matted silhouette.
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    if (band[i]) {
      const a = alpha[i];
      let shade = 0;
      if (mark[i]) {
        const t = Math.max(0, Math.min(1, (dist[i] - SHADOW_FLOOR) / (TOLERANCE - SHADOW_FLOOR)));
        shade = Math.pow(t, 1.4) * SHADOW_ALPHA;
      }
      if (a >= 1) { d[o + 3] = 255; continue; }
      if (shade > a) {
        d[o] = SHADOW_RGB[0]; d[o + 1] = SHADOW_RGB[1]; d[o + 2] = SHADOW_RGB[2];
        d[o + 3] = Math.round(shade * 255);
        continue;
      }
      if (a <= 0.02) { d[o + 3] = 0; continue; }
      d[o] = Math.max(0, Math.min(255, Math.round((d[o] - bg[0] * (1 - a)) / a)));
      d[o + 1] = Math.max(0, Math.min(255, Math.round((d[o + 1] - bg[1] * (1 - a)) / a)));
      d[o + 2] = Math.max(0, Math.min(255, Math.round((d[o + 2] - bg[2] * (1 - a)) / a)));
      d[o + 3] = Math.round(a * 255);
    } else if (mark[i]) {
      const t = Math.max(0, Math.min(1, (dist[i] - SHADOW_FLOOR) / (TOLERANCE - SHADOW_FLOOR)));
      d[o] = SHADOW_RGB[0]; d[o + 1] = SHADOW_RGB[1]; d[o + 2] = SHADOW_RGB[2];
      d[o + 3] = Math.round(Math.pow(t, 1.4) * SHADOW_ALPHA * 255);
    } else {
      d[o + 3] = 255;
    }
  }

  // Crop centred on the product, with equal room either side for its shadow.
  const padX = Math.round(bw * 0.45);
  const cx0 = Math.max(0, minX - padX);
  const cx1 = Math.min(w - 1, maxX + padX);
  const cy0 = Math.max(0, minY - Math.round(bh * 0.06));
  const cy1 = Math.min(h - 1, maxY + Math.round(bh * 0.12));
  const cw = cx1 - cx0 + 1;
  const ch = cy1 - cy0 + 1;
  const od = new Uint8ClampedArray(cw * ch * 4);
  const fade = Math.max(1, Math.round(cw * 0.2));
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const s = (cy0 + y) * w + cx0 + x;
      const si = s * 4;
      const oi = (y * cw + x) * 4;
      od[oi] = d[si]; od[oi + 1] = d[si + 1]; od[oi + 2] = d[si + 2];
      let a = d[si + 3];
      // Feather the shadow toward the left and right edges of the crop.
      const edge = Math.min(x, cw - 1 - x);
      if (edge < fade && mark[s]) {
        const t = edge / fade;
        a = Math.round(a * t * t * (3 - 2 * t));
      }
      od[oi + 3] = a;
    }
  }
  return { data: od, width: cw, height: ch, jarX: (minX + bw / 2 - cx0) / cw };
}

function processImage(img) {
  const scale = Math.min(1, MAX_WIDTH / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  let image;
  try {
    image = ctx.getImageData(0, 0, w, h);
  } catch {
    return null; // tainted canvas: the image is not CORS-readable
  }
  const cut = cutoutPixels(image.data, w, h);
  if (!cut) return null;
  const out = new ImageData(cut.data, cut.width, cut.height);
  const outCanvas = document.createElement("canvas");
  outCanvas.width = cut.width;
  outCanvas.height = cut.height;
  outCanvas.getContext("2d").putImageData(out, 0, 0);
  return new Promise((res) => {
    outCanvas.toBlob((blob) => {
      if (!blob) return res(null);
      res({ url: URL.createObjectURL(blob), width: cut.width, height: cut.height, ratio: cut.width / cut.height, jarX: cut.jarX });
    }, "image/png");
  });
}

/** Synchronously returns a finished cutout when one is cached. */
export function peekCutout(src) {
  return src ? resolved.get(src) ?? null : null;
}

/**
 * Resolves to `{ url, width, height, ratio, jarX }` or null.
 * @param {string} src
 */
export function getCutout(src) {
  if (!src || typeof document === "undefined") return Promise.resolve(null);
  if (resolved.has(src)) return Promise.resolve(resolved.get(src));
  if (pending.has(src)) return pending.get(src);
  const p = loadImage(src)
    .then((img) => processImage(img))
    .catch(() => null)
    .then((r) => { resolved.set(src, r); pending.delete(src); return r; });
  pending.set(src, p);
  return p;
}

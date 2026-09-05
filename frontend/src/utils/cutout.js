/**
 * cutout.js — Lifts a product photograph off its studio backdrop in the
 * browser, so the real jar can sit on a navy field or float over the hero
 * photograph without a grey rectangle around it.
 *
 * The store's photographs are shot on a flat near-white sweep with a soft
 * ground shadow. From the image border a flood fill marks everything that is
 * close to the backdrop colour; the jar itself stops the fill, so the white
 * type on its label is never touched. Marked pixels become transparent, and
 * the ones that were the shadow keep an alpha proportional to how dark they
 * were, which turns the photographed shadow into one that works on any
 * background. The result is cropped around the jar with room for that shadow
 * and returned as an object URL, cached per source URL.
 *
 * Anything that does not look like a studio shot (a dark backdrop, an image
 * the fill would swallow, a cross-origin image the canvas cannot read)
 * resolves to null so callers fall back to the plain photograph.
 *
 * @module utils/cutout
 */

const MAX_WIDTH = 1200;
const TOLERANCE = 55;
const SHADOW_RGB = [8, 12, 22];
const SHADOW_ALPHA = 0.85;

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

function process(img) {
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
  const d = image.data;
  const n = w * h;

  // Backdrop colour: the average of the four corners.
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
  const bg = [0, 0, 0];
  corners.forEach((o) => { bg[0] += d[o]; bg[1] += d[o + 1]; bg[2] += d[o + 2]; });
  bg[0] /= 4; bg[1] /= 4; bg[2] /= 4;
  if ((bg[0] + bg[1] + bg[2]) / 3 < 200) return null; // not a light studio sweep

  const dist = new Uint8Array(n);
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    const dr = Math.abs(d[o] - bg[0]);
    const dg = Math.abs(d[o + 1] - bg[1]);
    const db = Math.abs(d[o + 2] - bg[2]);
    dist[i] = Math.min(255, Math.max(dr, dg, db));
  }

  // Flood fill from the border through every pixel close to the backdrop.
  const mark = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const seed = (i) => { if (!mark[i] && dist[i] <= TOLERANCE) { mark[i] = 1; queue[tail++] = i; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (i >= w) seed(i - w);
    if (i + w < n) seed(i + w);
  }
  const filled = tail / n;
  if (filled < 0.2 || filled > 0.985) return null;

  // Transparent backdrop, shadow kept as alpha, and the bounding box of the
  // jar itself (the shadow is left out so the jar sits centred in the crop).
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    if (mark[i]) {
      const t = Math.min(1, dist[i] / TOLERANCE);
      d[o] = SHADOW_RGB[0]; d[o + 1] = SHADOW_RGB[1]; d[o + 2] = SHADOW_RGB[2];
      d[o + 3] = Math.round(Math.pow(t, 1.4) * SHADOW_ALPHA * 255);
    } else {
      d[o + 3] = 255;
      const x = i % w;
      const y = (i - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  if (bw < w * 0.08 || bh < h * 0.15) return null;

  // Crop centred on the jar, with equal room either side for its shadow.
  const padX = Math.round(bw * 0.45);
  const cx0 = Math.max(0, minX - padX);
  const cx1 = Math.min(w - 1, maxX + padX);
  const cy0 = Math.max(0, minY - Math.round(bh * 0.06));
  const cy1 = Math.min(h - 1, maxY + Math.round(bh * 0.12));
  const cw = cx1 - cx0 + 1;
  const ch = cy1 - cy0 + 1;
  const out = ctx.createImageData(cw, ch);
  const od = out.data;
  const fade = Math.max(1, Math.round(cw * 0.2));
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((cy0 + y) * w + cx0 + x) * 4;
      const oi = (y * cw + x) * 4;
      od[oi] = d[si]; od[oi + 1] = d[si + 1]; od[oi + 2] = d[si + 2];
      let a = d[si + 3];
      // Feather the shadow toward the left and right edges of the crop.
      const edge = Math.min(x, cw - 1 - x);
      if (edge < fade && mark[(cy0 + y) * w + cx0 + x]) {
        const t = edge / fade;
        a = Math.round(a * t * t * (3 - 2 * t));
      }
      od[oi + 3] = a;
    }
  }
  const outCanvas = document.createElement("canvas");
  outCanvas.width = cw;
  outCanvas.height = ch;
  outCanvas.getContext("2d").putImageData(out, 0, 0);
  return new Promise((res) => {
    outCanvas.toBlob((blob) => {
      if (!blob) return res(null);
      res({ url: URL.createObjectURL(blob), width: cw, height: ch, ratio: cw / ch, jarX: (minX + bw / 2 - cx0) / cw });
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
    .then((img) => process(img))
    .catch(() => null)
    .then((r) => { resolved.set(src, r); pending.delete(src); return r; });
  pending.set(src, p);
  return p;
}

/**
 * labelTexture.js — Draws a product's label onto a canvas so the 3D bottle
 * carries the real product name rather than a stock texture: the wordmark
 * from /logo.png (recoloured white), a band in the category's accent with
 * the name in capitals, the "best for" line beneath, and the form and
 * "Dietary Supplement" along the foot. Only the front third of the wrap
 * carries content; the rest stays black like the real pack.
 *
 * Textures are cached per product so a re-render never redraws.
 *
 * @module components/three/labelTexture
 */
import { CanvasTexture, SRGBColorSpace } from "three";
import { accentFor, formFor } from "./sequence";

const W = 2048;
const H = 560;
const cache = new Map();
let logoPromise = null;

function loadLogo() {
  if (logoPromise) return logoPromise;
  logoPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height);
        const px = data.data;
        // Keep the shape, paint it white; the O's orange ring stays amber.
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i], g = px[i + 1], b = px[i + 2];
          const isOrange = r > 180 && g > 80 && g < 190 && b < 110;
          if (!isOrange) { px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; }
        }
        ctx.putImageData(data, 0, 0);
        resolve(c);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = "/logo.png";
  });
  return logoPromise;
}

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load('800 120px "Bricolage Grotesque Variable"'),
      document.fonts.load('600 40px "Instrument Sans Variable"'),
    ]);
  } catch { /* fall back to the system face */ }
}

function fitText(ctx, text, maxWidth, size, weight, family) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    s -= 4;
  } while (s > 40);
  return s;
}

/** @returns {Promise<CanvasTexture>} */
export async function buildLabelTexture(product) {
  const key = product?.id || product?.name || "default";
  if (cache.has(key)) return cache.get(key);

  const p = (async () => {
    const [logo] = await Promise.all([loadLogo(), ensureFonts()]);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const display = '"Bricolage Grotesque Variable", "Instrument Sans Variable", sans-serif';
    const sans = '"Instrument Sans Variable", system-ui, sans-serif';

    // Ground: matte black with the faintest molecular dots, like the pack.
    ctx.fillStyle = "#0b0e15";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    for (let i = 0; i < 90; i++) {
      const x = ((i * 977) % W), y = ((i * 613) % H);
      ctx.beginPath(); ctx.arc(x, y, 3 + (i % 4), 0, Math.PI * 2); ctx.fill();
    }

    // Front panel occupies the middle third of the wrap.
    const left = W * 0.34, width = W * 0.32, right = left + width;
    const accent = accentFor(product?.category, product?.name);

    // Wordmark, top right of the panel.
    if (logo) {
      const lw = width * 0.42;
      const lh = lw * (logo.height / logo.width);
      ctx.drawImage(logo, right - lw, 48, lw, lh);
    } else {
      ctx.fillStyle = "#fff";
      ctx.font = `800 54px ${display}`;
      ctx.textAlign = "right";
      ctx.fillText("CORE ATOMS", right, 100);
      ctx.textAlign = "left";
    }

    // Accent band with the product name.
    const bandY = 190, bandH = 118;
    ctx.fillStyle = accent;
    ctx.fillRect(left, bandY, width, bandH);
    const name = String(product?.name || "Formula").replace(/\s*\+\s*/g, " + ").toUpperCase();
    ctx.fillStyle = "#fff";
    const size = fitText(ctx, name, width - 40, 78, 800, display);
    ctx.font = `800 ${size}px ${display}`;
    ctx.textBaseline = "middle";
    ctx.fillText(name, left + 22, bandY + bandH / 2 + 4);

    // Best-for line.
    const bestFor = String(product?.bestFor || product?.category || "").split(/\s*[•·|,]\s*/).filter(Boolean).slice(0, 3).join("  |  ");
    if (bestFor) {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      const s2 = fitText(ctx, bestFor.toUpperCase(), width - 40, 34, 700, sans);
      ctx.font = `700 ${s2}px ${sans}`;
      ctx.fillText(bestFor.toUpperCase(), left + 22, bandY + bandH + 46);
    }

    // Foot line.
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `600 30px ${sans}`;
    const form = formFor(product) === "tablet" ? "Tablets" : "Capsules";
    ctx.fillText(`${form}  |  Dietary Supplement`, left + 22, H - 52);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(right - 34, H - 78, 22, 22);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeRect(right - 34, H - 78, 22, 22);

    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  })();

  cache.set(key, p);
  return p;
}

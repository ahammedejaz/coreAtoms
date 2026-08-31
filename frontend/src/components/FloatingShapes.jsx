/**
 * FloatingShapes.jsx — Floating shopping/supplement-themed elements.
 *
 * Renders emoji icons related to nutraceuticals and shopping that float
 * randomly around the viewport. When the cursor approaches, they scatter
 * away. Fully canvas-driven at 60 fps.
 *
 * Purely decorative, so the loop never starts at all when the visitor prefers
 * reduced motion or is on a narrow viewport — a phone has no cursor to repel
 * the shapes with, and no frames to spare for a background animation.
 *
 * @module components/FloatingShapes
 */
import { useEffect, useRef } from "react";

/* ── Shopping & supplement icons ─────────────────────────────────────────── */
const ICONS = [
    { emoji: "💊", size: 32 },
    { emoji: "🧪", size: 30 },
    { emoji: "🛒", size: 34 },
    { emoji: "🧬", size: 30 },
    { emoji: "🌿", size: 32 },
    { emoji: "📦", size: 30 },
    { emoji: "🔬", size: 28 },
    { emoji: "✨", size: 26 },
    { emoji: "💊", size: 28 },
    { emoji: "🛍️", size: 32 },
    { emoji: "🧴", size: 30 },
    { emoji: "🌱", size: 28 },
    { emoji: "🏷️", size: 26 },
    { emoji: "⚗️", size: 28 },
    { emoji: "💎", size: 24 },
];

const REPEL_RADIUS = 40;
const REPEL_STRENGTH = 6;
const FRICTION = 0.97;
const BASE_SPEED = 0.45;
/** Below this width the animation is skipped entirely. */
const MIN_VIEWPORT_WIDTH = 768;
/** One font size is set per frame; per-particle sizes come from ctx.scale(). */
const BASE_FONT_SIZE = 32;
const BASE_FONT = `${BASE_FONT_SIZE}px serif`;

function randomBetween(a, b) {
    return a + Math.random() * (b - a);
}

export default function FloatingShapes() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Decorative only — bail before allocating anything.
        const prefersReducedMotion =
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (prefersReducedMotion || window.innerWidth < MIN_VIEWPORT_WIDTH) return;

        const ctx = canvas.getContext("2d");

        // Handle device pixel ratio for sharp rendering
        const dpr = window.devicePixelRatio || 1;
        let w = window.innerWidth;
        let h = window.innerHeight;

        const setCanvasSize = () => {
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = w + "px";
            canvas.style.height = h + "px";
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        setCanvasSize();

        // Mouse
        const mouse = { x: -9999, y: -9999 };
        const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
        const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
        window.addEventListener("mousemove", onMove, { passive: true });
        document.addEventListener("mouseleave", onLeave);
        window.addEventListener("resize", setCanvasSize, { passive: true });

        // Initialise particles
        const particles = ICONS.map((icon) => ({
            x: randomBetween(40, w - 40),
            y: randomBetween(40, h - 40),
            vx: randomBetween(-BASE_SPEED, BASE_SPEED),
            vy: randomBetween(-BASE_SPEED, BASE_SPEED),
            emoji: icon.emoji,
            size: icon.size,
            scale: icon.size / BASE_FONT_SIZE,
            angle: Math.random() * Math.PI * 2,
            angleSpeed: randomBetween(0.001, 0.003) * (Math.random() > 0.5 ? 1 : -1),
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: randomBetween(0.002, 0.006) * (Math.random() > 0.5 ? 1 : -1),
            opacity: randomBetween(0.18, 0.35),
        }));

        let raf;

        const tick = () => {
            ctx.clearRect(0, 0, w, h);

            // Set once per frame rather than once per particle. A resize resets
            // the whole 2D context, so this can't be hoisted out of the loop
            // entirely — but it survives the save()/restore() pairs below.
            ctx.font = BASE_FONT;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            for (const p of particles) {
                // Idle drift
                p.angle += p.angleSpeed;
                p.vx += Math.cos(p.angle) * 0.009;
                p.vy += Math.sin(p.angle) * 0.009;

                // Mouse repulsion
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < REPEL_RADIUS && dist > 0) {
                    const force = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH;
                    p.vx += (dx / dist) * force;
                    p.vy += (dy / dist) * force;
                }

                // Friction
                p.vx *= FRICTION;
                p.vy *= FRICTION;

                // Clamp speed
                const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                if (speed > 4) { p.vx = (p.vx / speed) * 4; p.vy = (p.vy / speed) * 4; }

                // Move
                p.x += p.vx;
                p.y += p.vy;

                // Rotate
                p.rotation += p.rotationSpeed;

                // Soft bounce off edges
                const pad = p.size;
                if (p.x < -pad) { p.x = -pad; p.vx *= -0.5; }
                if (p.x > w + pad) { p.x = w + pad; p.vx *= -0.5; }
                if (p.y < -pad) { p.y = -pad; p.vy *= -0.5; }
                if (p.y > h + pad) { p.y = h + pad; p.vy *= -0.5; }

                // Draw emoji with rotation and opacity — per-particle size comes
                // from the transform, so the font string never changes.
                ctx.save();
                ctx.globalAlpha = p.opacity;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.scale(p.scale, p.scale);
                ctx.fillText(p.emoji, 0, 0);
                ctx.restore();
            }

            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("resize", setCanvasSize);
            document.removeEventListener("mouseleave", onLeave);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 0,
                pointerEvents: "none",
            }}
        />
    );
}

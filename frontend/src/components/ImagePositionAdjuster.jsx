/**
 * ImagePositionAdjuster.jsx — Shared drag-to-reposition modal for images.
 *
 * Used by `AdminProducts` (product card images with zoom) and
 * `AdminHomepage` (hero carousel images without zoom).
 *
 * ### Props:
 * | Prop       | Type       | Description |
 * |------------|------------|-------------|
 * | `src`      | `string`   | Image URL (or blob preview) to display |
 * | `position` | `string?`  | Initial CSS `objectPosition`, e.g. `"50% 50%"` |
 * | `showZoom` | `boolean?` | Whether to show the zoom slider (default `false`) |
 * | `aspectRatio` | `string?` | CSS `aspect-ratio` for the preview (default `"2/1"`) |
 * | `onSave`   | `Function` | Called with the final position string, e.g. `"30% 70%"` |
 * | `onClose`  | `Function` | Called when the modal should close |
 *
 * @module components/ImagePositionAdjuster
 */
import { useEffect, useRef, useState } from "react";

export default function ImagePositionAdjuster({
    src,
    position,
    showZoom = false,
    aspectRatio = "2/1",
    onSave,
    onClose,
}) {
    const containerRef = useRef(null);
    const [pos, setPos] = useState(() => {
        if (position) {
            const parts = position.split(" ");
            return { x: parseFloat(parts[0]) || 50, y: parseFloat(parts[1]) || 50 };
        }
        return { x: 50, y: 50 };
    });
    const [zoom, setZoom] = useState(() => {
        if (showZoom && position && position.includes("/")) {
            return parseFloat(position.split("/")[1]) || 1;
        }
        return 1;
    });
    const dragging = useRef(false);
    const lastMouse = useRef(null);

    // ── Mouse drag ──────────────────────────────────────────────────────────
    useEffect(() => {
        const onMouseMove = (e) => {
            if (!dragging.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const dx = e.clientX - lastMouse.current.x;
            const dy = e.clientY - lastMouse.current.y;
            lastMouse.current = { x: e.clientX, y: e.clientY };
            setPos((p) => ({
                x: Math.max(0, Math.min(100, p.x - (dx / rect.width) * 100)),
                y: Math.max(0, Math.min(100, p.y - (dy / rect.height) * 100)),
            }));
        };
        const onMouseUp = () => { dragging.current = false; };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
    }, []);

    // ── Touch drag ──────────────────────────────────────────────────────────
    useEffect(() => {
        const onTouchMove = (e) => {
            if (!dragging.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const dx = e.touches[0].clientX - lastMouse.current.x;
            const dy = e.touches[0].clientY - lastMouse.current.y;
            lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            setPos((p) => ({
                x: Math.max(0, Math.min(100, p.x - (dx / rect.width) * 100)),
                y: Math.max(0, Math.min(100, p.y - (dy / rect.height) * 100)),
            }));
            e.preventDefault();
        };
        const onTouchEnd = () => { dragging.current = false; };
        window.addEventListener("touchmove", onTouchMove, { passive: false });
        window.addEventListener("touchend", onTouchEnd);
        return () => { window.removeEventListener("touchmove", onTouchMove); window.removeEventListener("touchend", onTouchEnd); };
    }, []);

    const posStr = `${Math.round(pos.x)}% ${Math.round(pos.y)}%`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E4DE]">
                    <div>
                        <div className="text-sm font-semibold text-stone-900">
                            Adjust Image Position{showZoom ? " & Zoom" : ""}
                        </div>
                        <div className="text-xs text-stone-400 mt-0.5">
                            Drag to reposition{showZoom ? " · use slider to zoom" : ""}
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="h-7 w-7 rounded-full border border-[#E8E4DE] flex items-center justify-center text-stone-400 hover:text-stone-700">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                </div>

                <div className="p-5">
                    {/* Preview frame */}
                    <div
                        ref={containerRef}
                        className="relative overflow-hidden rounded-xl border-2 border-[#1e3a5f]/30 select-none w-full"
                        style={{ aspectRatio, cursor: "grab" }}
                        onMouseDown={(e) => { dragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; e.preventDefault(); }}
                        onTouchStart={(e) => { dragging.current = true; lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
                    >
                        <img
                            src={src}
                            alt="Position preview"
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            style={{
                                objectFit: "cover",
                                objectPosition: posStr,
                                transform: showZoom && zoom !== 1 ? `scale(${zoom})` : undefined,
                                transformOrigin: showZoom ? posStr : undefined,
                            }}
                            draggable={false}
                        />
                        {/* Rule-of-thirds grid */}
                        <div className="absolute inset-0 pointer-events-none" style={{
                            backgroundImage: "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
                            backgroundSize: "33.33% 33.33%",
                        }} />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="h-5 w-5 rounded-full border-2 border-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" />
                        </div>
                        <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
                            <span className="inline-flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-sm px-3 py-1 text-[10px] text-white font-medium">✦ Drag to reposition</span>
                        </div>
                    </div>

                    {/* Zoom slider (optional) */}
                    {showZoom && (
                        <div className="mt-4">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="text-xs text-stone-500 font-medium">Zoom</div>
                                <div className="text-xs font-mono text-stone-700">{zoom.toFixed(2)}×</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-stone-400">1×</span>
                                <input type="range" min="100" max="200" step="1" value={Math.round(zoom * 100)}
                                    onChange={(e) => setZoom(Number(e.target.value) / 100)}
                                    className="flex-1 accent-[#1e3a5f]" />
                                <span className="text-xs text-stone-400">2×</span>
                            </div>
                        </div>
                    )}

                    {/* Position info + presets */}
                    <div className="mt-3 flex items-center justify-between">
                        <div className="text-xs text-stone-400">Position: <span className="font-mono text-stone-700">{posStr}</span></div>
                        <button type="button" onClick={() => { setPos({ x: 50, y: 50 }); setZoom(1); }} className="text-xs text-[#1e3a5f] hover:underline">Reset</button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {[
                            { label: "Top", pos: { x: 50, y: 15 } },
                            { label: "Center", pos: { x: 50, y: 50 } },
                            { label: "Bottom", pos: { x: 50, y: 85 } },
                            { label: "Left", pos: { x: 20, y: 50 } },
                            { label: "Right", pos: { x: 80, y: 50 } },
                        ].map(({ label, pos: p }) => (
                            <button key={label} type="button" onClick={() => setPos(p)}
                                className="rounded-lg border border-[#E8E4DE] bg-stone-50 px-2.5 py-1 text-xs text-stone-600 hover:border-[#1e3a5f]/40 hover:bg-[#EFF6FF] transition">{label}</button>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[#E8E4DE]">
                    <button type="button" onClick={onClose} className="rounded-xl border border-[#E8E4DE] px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">Cancel</button>
                    <button type="button" onClick={() => { onSave(posStr); onClose(); }}
                        className="rounded-xl bg-[#1e3a5f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#16304f] transition">Apply</button>
                </div>
            </div>
        </div>
    );
}

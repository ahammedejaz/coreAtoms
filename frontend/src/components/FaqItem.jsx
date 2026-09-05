/**
 * FaqItem.jsx — One expandable question row: the question as a full-width
 * button with a plus that turns into a cross, the answer revealed by
 * animating grid rows so the height needs no measurement.
 *
 * @param {{ q: string, a: string, open: boolean, onToggle: Function }} props
 * @module components/FaqItem
 */
import { Plus } from "lucide-react";

export default function FaqItem({ q, a, open, onToggle }) {
    return (
        <div>
            <button type="button" onClick={onToggle} aria-expanded={open}
                className="flex w-full items-center justify-between gap-4 py-4 text-left">
                <span className="text-[15px] font-semibold text-ink">{q}</span>
                <Plus className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 ease-out ${open ? "rotate-45" : ""}`} strokeWidth={2} aria-hidden="true" />
            </button>
            <div className={`grid transition-[grid-template-rows] duration-250 ease-out-strong ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                    <p className="pb-5 pr-8 text-[15px] leading-relaxed text-stone-600">{a}</p>
                </div>
            </div>
        </div>
    );
}

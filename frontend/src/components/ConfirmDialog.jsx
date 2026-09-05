/**
 * ConfirmDialog.jsx — Inline confirmation modal.
 *
 * Replaces `window.confirm()` with a styled, keyboard-accessible modal.
 * Supports `danger` and `info` variants for different action types.
 *
 * @example
 * const [dlg, setDlg] = useState(null);
 * // Show: setDlg({ title: "Delete?", message: "…", onConfirm: () => … });
 * // Hide: setDlg(null);
 * {dlg && <ConfirmDialog {...dlg} onCancel={() => setDlg(null)} />}
 *
 * @module components/ConfirmDialog
 */
import { useEffect, useRef } from "react";
import { Info, TriangleAlert } from "lucide-react";

export default function ConfirmDialog({
    title = "Confirm",
    message = "Are you sure?",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "danger", // "danger" | "info"
    loading = false,
    onConfirm,
    onCancel,
}) {
    const confirmRef = useRef(null);

    // Focus the confirm button on mount, trap Escape
    useEffect(() => {
        confirmRef.current?.focus();
        const onKey = (e) => {
            if (e.key === "Escape") { e.preventDefault(); onCancel?.(); }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onCancel]);

    const danger = variant === "danger";
    const Icon = danger ? TriangleAlert : Info;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={onCancel}>
            <div className="absolute inset-0 bg-navy-950/45 backdrop-blur-[2px]" />

            <div
                className="animate-toast-in relative w-full max-w-sm rounded-panel border border-line bg-white p-6 shadow-lift-lg"
                onClick={(e) => e.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
                aria-label={title}
            >
                <div className="flex items-start gap-4">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${danger ? "bg-red-50 text-red-600" : "bg-brand-soft text-brand"}`}>
                        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-display text-lg font-semibold tracking-tight text-ink">{title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-stone-600">{message}</p>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-2">
                    <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary disabled:opacity-40">
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmRef}
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={danger
                            ? "inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,scale] duration-150 ease-out-strong hover:bg-red-700 active:scale-[0.97] disabled:opacity-40"
                            : "btn-primary disabled:opacity-40"}
                    >
                        {loading ? "Working…" : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

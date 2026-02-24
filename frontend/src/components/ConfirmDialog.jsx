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

    const colors = variant === "danger"
        ? { btn: "bg-red-600 hover:bg-red-700 focus:ring-red-500", icon: "text-red-500 bg-red-50 border-red-200" }
        : { btn: "bg-[#1e3a5f] hover:bg-[#16304f] focus:ring-[#1e3a5f]", icon: "text-blue-500 bg-blue-50 border-blue-200" };

    const iconPath = variant === "danger"
        ? "M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        : "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z";

    return (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" onClick={onCancel}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

            {/* Dialog */}
            <div
                className="relative w-full max-w-sm rounded-2xl border border-[#E8E4DE] bg-white p-6 shadow-xl animate-toast-in"
                onClick={(e) => e.stopPropagation()}
                role="alertdialog"
                aria-label={title}
            >
                <div className="flex items-start gap-4">
                    <div className={`shrink-0 h-10 w-10 rounded-xl border flex items-center justify-center ${colors.icon}`}>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d={iconPath} clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
                        <p className="mt-1 text-sm text-stone-500 leading-relaxed">{message}</p>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="rounded-xl border border-[#E8E4DE] bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition disabled:opacity-40"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmRef}
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition focus:ring-2 focus:ring-offset-2 disabled:opacity-40 ${colors.btn}`}
                    >
                        {loading ? "Working…" : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

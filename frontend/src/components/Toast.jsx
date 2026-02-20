import { useEffect } from "react";

export default function Toast({ toast, onClose }) {
    useEffect(() => {
        if (!toast?.open) return;
        const t = setTimeout(() => onClose?.(), toast.duration || 3000);
        return () => clearTimeout(t);
    }, [toast?.open, toast?.duration, onClose]);

    if (!toast?.open) return null;

    const variantStyles = {
        success: "border-green-200 bg-green-50 text-green-900",
        error: "border-red-200 bg-red-50 text-red-900",
        info: "border-neutral-200 bg-white text-neutral-900",
        warning: "border-amber-200 bg-amber-50 text-amber-900",
    };

    const icon = {
        success: "✅",
        error: "⚠️",
        info: "ℹ️",
        warning: "⚠️",
    }[toast.variant || "info"];

    return (
        <div className="fixed right-4 top-4 z-[9999]">
            <div
                className={`min-w-[320px] max-w-[420px] rounded-2xl border px-4 py-3 shadow-lg ${variantStyles[toast.variant || "info"]} animate-[toastIn_220ms_ease-out]`}
            >
                <div className="flex items-start gap-3">
                    <div className="text-lg leading-none">{icon}</div>
                    <div className="min-w-0">
                        {toast.title && (
                            <div className="text-sm font-semibold">{toast.title}</div>
                        )}
                        {toast.message && (
                            <div className="mt-0.5 text-sm opacity-90 break-words">
                                {toast.message}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="ml-auto text-sm opacity-70 hover:opacity-100"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
            </div>
        </div>
    );
}
/**
 * ToastContext.jsx — Global toast notification system.
 *
 * Provides `useToast()` hook with `showToast(message, variant, duration)`
 * method. Renders toasts at the app root with auto-dismiss and
 * smooth enter/exit animations.
 *
 * ### Variants: `"success"` | `"error"` | `"info"` | `"warning"`
 *
 * @module context/ToastContext
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

const VARIANT_STYLES = {
    success: "bg-emerald-600 text-white",
    error: "bg-red-600 text-white",
    info: "bg-[#1e3a5f] text-white",
    warning: "bg-amber-500 text-white",
};

/**
 * Toast provider — wrap your app with this to enable `useToast()`.
 * Renders a fixed toast container at the top of the viewport.
 */
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const idRef = useRef(0);

    const showToast = useCallback((message, variant = "info", duration = 3000, action = null) => {
        const id = ++idRef.current;
        setToasts((prev) => [...prev, { id, message, variant, action, exiting: false }]);

        const timerId = setTimeout(() => {
            // Start exit animation
            setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t));
            // Remove after animation
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, 300);
        }, duration);

        // Return a cancel function so callers can extend the toast
        return () => clearTimeout(timerId);
    }, []);

    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t));
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 300);
    }, []);

    const value = useMemo(() => ({ showToast }), [showToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* Toast container */}
            {toasts.length > 0 && (
                <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 380 }}>
                    {toasts.map((toast) => (
                        <div
                            key={toast.id}
                            className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium backdrop-blur-sm transition-all duration-300 ${VARIANT_STYLES[toast.variant] || VARIANT_STYLES.info
                                } ${toast.exiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0 animate-toast-in"}`}
                        >
                            <span className="flex-1">{toast.message}</span>
                            {toast.action && (
                                <button
                                    onClick={() => { toast.action.onClick(); dismiss(toast.id); }}
                                    className="shrink-0 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/30 transition"
                                >
                                    {toast.action.label || "Undo"}
                                </button>
                            )}
                            <button
                                onClick={() => dismiss(toast.id)}
                                className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                                aria-label="Dismiss notification"
                            >
                                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </ToastContext.Provider>
    );
}

/**
 * Hook to access the toast system.
 * @returns {{ showToast: (message: string, variant?: string, duration?: number) => void }}
 */
export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used inside ToastProvider");
    return ctx;
}

/**
 * useKeyboardShortcut.js — Lightweight keyboard shortcut hook.
 *
 * @example
 * useKeyboardShortcut("ctrl+s", (e) => { e.preventDefault(); save(); });
 * useKeyboardShortcut("escape", () => close());
 *
 * Supports: ctrl, shift, alt, meta modifiers.
 * Keys are case-insensitive: "ctrl+S" and "ctrl+s" both work.
 *
 * @module hooks/useKeyboardShortcut
 */
import { useEffect } from "react";

export default function useKeyboardShortcut(combo, callback, deps = []) {
    useEffect(() => {
        if (!combo || !callback) return;

        const parts = combo.toLowerCase().split("+").map((s) => s.trim());
        const key = parts.pop();
        const mods = new Set(parts);

        const handler = (e) => {
            const modMatch =
                mods.has("ctrl") === (e.ctrlKey || e.metaKey) &&
                mods.has("shift") === e.shiftKey &&
                mods.has("alt") === e.altKey;

            if (modMatch && e.key.toLowerCase() === key) {
                callback(e);
            }
        };

        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [combo, callback, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}

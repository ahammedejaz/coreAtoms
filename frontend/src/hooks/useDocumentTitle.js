/**
 * useDocumentTitle.js — Zero-dependency hook for dynamic page titles.
 *
 * Sets `document.title` on mount and when the title changes.
 * Restores the original title on unmount.
 *
 * @param {string} title — The page title to set
 *
 * @module hooks/useDocumentTitle
 */
import { useEffect, useRef } from "react";

export default function useDocumentTitle(title) {
    const prevTitle = useRef(document.title);

    useEffect(() => {
        document.title = title;
    }, [title]);

    useEffect(() => {
        const original = prevTitle.current;
        return () => { document.title = original; };
    }, []);
}

/**
 * useDebounce.js — Custom hook for debouncing values.
 *
 * Returns a debounced version of the input value that only updates
 * after `delay` ms of no changes. Useful for search inputs.
 *
 * @param {*} value — The value to debounce
 * @param {number} delay — Debounce delay in milliseconds (default 300)
 * @returns {*} The debounced value
 *
 * @module hooks/useDebounce
 */
import { useEffect, useState } from "react";

export default function useDebounce(value, delay = 300) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
}

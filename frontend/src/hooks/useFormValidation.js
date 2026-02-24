/**
 * useFormValidation.js — Lightweight form validation hook.
 *
 * Accepts a `rules` object mapping field names to validation functions.
 * Returns field errors, touched state, and validation helpers.
 *
 * ### Usage:
 * ```js
 * const { errors, touched, validate, touchField, isValid } = useFormValidation(values, {
 *   name: (v) => (!v.trim() ? "Name is required" : ""),
 *   phone: (v) => (!/^\d{10}$/.test(v) ? "10-digit phone required" : ""),
 * });
 * ```
 *
 * @param {object} values — Current form values (keyed by field name)
 * @param {object} rules — Validation rules: `{ fieldName: (value) => errorString | "" }`
 * @returns {{ errors, touched, validate, touchField, isValid }}
 *
 * @module hooks/useFormValidation
 */
import { useCallback, useMemo, useState } from "react";

export default function useFormValidation(values, rules) {
    const [touched, setTouched] = useState({});

    /** Mark a field as touched (show errors after user interaction). */
    const touchField = useCallback((field) => {
        setTouched((prev) => ({ ...prev, [field]: true }));
    }, []);

    /** Touch all fields at once (call before form submit). */
    const touchAll = useCallback(() => {
        const all = {};
        for (const key of Object.keys(rules)) all[key] = true;
        setTouched(all);
    }, [rules]);

    /** Compute current errors for all fields. */
    const errors = useMemo(() => {
        const errs = {};
        for (const [field, rule] of Object.entries(rules)) {
            const msg = rule(values[field] ?? "");
            if (msg) errs[field] = msg;
        }
        return errs;
    }, [values, rules]);

    /** Run validation, touch all fields, return true if valid. */
    const validate = useCallback(() => {
        touchAll();
        return Object.keys(errors).length === 0;
    }, [touchAll, errors]);

    /** True if there are zero errors (regardless of touched state). */
    const isValid = Object.keys(errors).length === 0;

    return { errors, touched, validate, touchField, touchAll, isValid };
}

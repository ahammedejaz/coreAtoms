/**
 * errorReporter.js — Environment-aware error reporting utility.
 *
 * In development: enhanced console.error with context metadata.
 * In production: can be extended to POST to Sentry, LogRocket, or
 * any external error tracking service.
 *
 * @module services/errorReporter
 */

const IS_PROD = import.meta.env.PROD;

/**
 * Reports an error with optional context.
 *
 * @param {Error|string} error - The error to report.
 * @param {object} [context] - Additional context (component, action, userId, etc.).
 */
export function reportError(error, context = {}) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const timestamp = new Date().toISOString();

    if (IS_PROD) {
        // ── Production ─────────────────────────────────────────────────────
        // Extend this block to integrate with Sentry, LogRocket, etc.
        // Example:
        //   Sentry.captureException(errorObj, { extra: context });
        //
        // For now, log a compact summary to the console so errors
        // are still visible in production browser DevTools.
        console.error(`[CoreAtoms Error] ${errorObj.message}`, {
            ...context,
            timestamp,
            stack: errorObj.stack,
        });
    } else {
        // ── Development ────────────────────────────────────────────────────
        console.error(
            `%c[CoreAtoms Error]%c ${errorObj.message}`,
            "color: #dc2626; font-weight: bold;",
            "color: inherit;",
            "\n  Context:", context,
            "\n  Timestamp:", timestamp,
            "\n  Stack:", errorObj.stack
        );
    }
}

/**
 * Reports a warning (non-fatal issue).
 *
 * @param {string} message
 * @param {object} [context]
 */
export function reportWarning(message, context = {}) {
    if (IS_PROD) {
        console.warn(`[CoreAtoms Warning] ${message}`, context);
    } else {
        console.warn(
            `%c[CoreAtoms Warning]%c ${message}`,
            "color: #d97706; font-weight: bold;",
            "color: inherit;",
            "\n  Context:", context
        );
    }
}

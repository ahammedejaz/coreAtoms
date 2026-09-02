/**
 * format.js — Shared formatting utilities.
 *
 * @module utils/format
 */

/**
 * Format a number as Indian Rupees (₹).
 * @param {number} n - Amount to format.
 * @returns {string} e.g. "₹1,499"
 */
export const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/**
 * Percent saved when a product's MRP exceeds its selling price.
 * @param {number|null} mrp - Maximum retail price.
 * @param {number} price - Actual selling price.
 * @returns {number|null} Whole-number percent (e.g. 25), or null when there is
 *   no genuine discount to show (missing MRP, or MRP <= price).
 */
export const discountPercent = (mrp, price) => {
    const m = Number(mrp);
    const pr = Number(price);
    if (!Number.isFinite(m) || !Number.isFinite(pr) || m <= pr || m <= 0) return null;
    const pct = Math.round(((m - pr) / m) * 100);
    return pct > 0 ? pct : null;
};

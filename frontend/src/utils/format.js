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

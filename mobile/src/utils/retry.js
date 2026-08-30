/**
 * retry.js — Retry-with-backoff utility for transient network failures.
 *
 * Usage:
 *   const data = await retryAsync(() => fetchSomething(), { attempts: 3, backoffMs: 300 });
 */

/**
 * Retry an async function with exponential backoff.
 * @param {() => Promise<T>} fn - Async function to retry.
 * @param {Object} opts
 * @param {number} [opts.attempts=3] - Maximum number of attempts.
 * @param {number} [opts.backoffMs=300] - Base backoff in ms (doubles each retry).
 * @returns {Promise<T>}
 */
export async function retryAsync(fn, { attempts = 3, backoffMs = 300 } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Don't retry on non-transient errors
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('not found')) {
        throw err;
      }
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

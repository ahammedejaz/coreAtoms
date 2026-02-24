/**
 * settings.js — Admin settings API helpers.
 *
 * Reads/writes the `max_items_per_order` value from the `app_settings`
 * table in Supabase. The stored JSON shape is `{ n: <number> }`.
 *
 * @module services/api/settings
 */
import { supabase } from "../supabase/client";

/**
 * Fetches the current max-items-per-order limit from Supabase.
 * @returns {Promise<number>} The limit (defaults to 15 if value is missing/invalid).
 */
export async function getMaxItemsPerOrder() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "max_items_per_order")
    .single();

  if (error) throw error;

  const n = data?.value?.n;
  return Number.isFinite(Number(n)) ? Number(n) : 15;
}

/**
 * Updates the max-items-per-order limit in Supabase.
 * @param {number} n - New limit (must be > 0).
 * @returns {Promise<boolean>} `true` on success.
 */
export async function setMaxItemsPerOrder(n) {
  const val = { n: Number(n) };

  const { error } = await supabase
    .from("app_settings")
    .update({ value: val, updated_at: new Date().toISOString() })
    .eq("key", "max_items_per_order");

  if (error) throw error;

  return true;
}

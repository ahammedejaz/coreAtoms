/**
 * settings.js — Cached reads of the public pricing settings.
 *
 * `shipping_amount`, `free_shipping_min` and `gst_percentage` are needed by
 * the announcement bar, the cart drawer and the cart page on every visit.
 * One request serves all three for the life of the page load; Checkout
 * keeps its own read because it must be fresh at the moment of purchase.
 *
 * Never throws: a failed read resolves to zeros so the UI simply omits the
 * shipping copy instead of breaking.
 *
 * @module services/settings
 */
import { supabase } from "./supabase/client";

export const EMPTY_PRICING = Object.freeze({ shippingBase: 0, freeShippingMin: 0, gstPercent: 0, codEnabled: true });

let cache = null;
let inflight = null;

export async function fetchPricingSettings() {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key,value")
        .in("key", ["shipping_amount", "free_shipping_min", "gst_percentage", "cod_enabled"]);
      if (error) return EMPTY_PRICING;
      const map = {};
      (data || []).forEach((row) => { map[row.key] = row.value; });
      const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0);
      cache = {
        shippingBase: num(map.shipping_amount?.amount),
        freeShippingMin: num(map.free_shipping_min?.amount),
        gstPercent: num(map.gst_percentage?.percentage),
        codEnabled: map.cod_enabled?.enabled !== false,
      };
      return cache;
    } catch {
      return EMPTY_PRICING;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

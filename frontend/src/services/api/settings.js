import { supabase } from "../supabase/client";

// Reads setting: { n: 15 }
export async function getMaxItemsPerOrder() {
  const { data, error } = await supabase
    .from("store_settings")
    .select("value")
    .eq("key", "max_items_per_order")
    .single();

  if (error) throw error;

  const n = data?.value?.n;
  return Number.isFinite(Number(n)) ? Number(n) : 15;
}

export async function setMaxItemsPerOrder(n) {
  const val = { n: Number(n) };

  const { error } = await supabase
    .from("store_settings")
    .update({ value: val, updated_at: new Date().toISOString() })
    .eq("key", "max_items_per_order");

  if (error) throw error;

  return true;
}

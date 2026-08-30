/**
 * settings.js — App settings service (mirrors web app).
 */
import { supabase } from '../supabase/client';

export async function getMaxItemsPerOrder() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'max_items_per_order')
    .maybeSingle();

  if (error) throw error;

  const n = data?.value?.n;
  return Number.isFinite(Number(n)) ? Number(n) : 15;
}

/**
 * Fetches a single app setting by key.
 * @param {string} key
 * @returns {Promise<any>} The value field of the setting.
 */
export async function getAppSetting(key) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) throw error;
  return data?.value ?? null;
}

/**
 * Fetches multiple app settings by keys.
 * @param {string[]} keys
 * @returns {Promise<Object>} Map of key → value.
 */
export async function getAppSettings(keys) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key,value')
    .in('key', keys);

  if (error) throw error;

  const result = {};
  (data || []).forEach((row) => { result[row.key] = row.value; });
  return result;
}

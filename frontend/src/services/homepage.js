/**
 * homepage.js — Homepage settings service layer.
 *
 * Centralizes the Supabase query for homepage settings,
 * keeping Home.jsx thin and improving testability.
 *
 * @module services/homepage
 */
import { supabase } from "./supabase/client";

const HOMEPAGE_KEYS = [
    "homepage_hero_images",
    "homepage_hero_copy",
    "homepage_featured_products",
    "homepage_pillars",
    "homepage_categories",
    "homepage_philosophy",
];

/**
 * Fetches all homepage settings from the `app_settings` table.
 * @returns {Promise<Record<string, any>>} Key-value map of homepage settings.
 */
export async function fetchHomepageSettings() {
    const { data, error } = await supabase
        .from("app_settings")
        .select("key,value")
        .in("key", HOMEPAGE_KEYS);

    if (error) throw error;

    const map = {};
    (data || []).forEach((row) => { map[row.key] = row.value; });
    return map;
}

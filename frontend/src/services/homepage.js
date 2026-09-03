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

/** The six-entry default category set — also the Navbar's category-row fallback
 *  when `homepage_categories` hasn't been saved yet. */
export const DEFAULT_HOME_CATEGORIES = [
    { label: "Multivitamins", emoji: "💊", category: "General Wellness" },
    { label: "Joint Support", emoji: "🦴", category: "Joint Support" },
    { label: "Bone Health", emoji: "🧬", category: "Bone Health" },
    { label: "Hair & Skin", emoji: "✨", category: "HSN" },
    { label: "Gut Health", emoji: "🌿", category: "Gut Health" },
    { label: "Collagen", emoji: "🔬", category: "Collagen" },
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

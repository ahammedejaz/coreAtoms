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
    "homepage_why_us",
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

/** Default "why us" proof band copy — shown until the admin saves `homepage_why_us`. */
export const DEFAULT_WHY_US = {
    label: "Why Core Atoms",
    heading: "Formulated on evidence, not on trends.",
    body: "Every Core Atoms formula is built around ingredients with a clear purpose, disclosed in full on the label and verified batch by batch. No proprietary blends, no fillers, no inflated claims.",
    cta: "Shop the range",
    stats: [
        { value: "100%", label: "Fully disclosed labels" },
        { value: "3rd party", label: "Lab-tested batches" },
        { value: "24 hrs", label: "Dispatch window" },
        { value: "Pan-India", label: "COD delivery" },
    ],
};

/**
 * Fetches the newest reviews worth showing as homepage testimonials: rated 4+
 * with a non-empty body. Never throws — testimonials must not fail the page.
 * @returns {Promise<Array<{id, rating, title, body, reviewerName, productName, createdAt}>>}
 */
export async function fetchHomepageReviews(limit = 6) {
    const { data, error } = await supabase
        .from("product_reviews")
        .select("id,rating,title,body,reviewer_name,created_at,products(name)")
        .gte("rating", 4)
        .not("body", "is", null)
        .neq("body", "")
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;

    return (data || []).map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title || "",
        body: r.body || "",
        reviewerName: r.reviewer_name || "Customer",
        productName: r.products?.name || "",
        createdAt: r.created_at,
    }));
}

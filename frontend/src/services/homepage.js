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

/* ── Home page content ────────────────────────────────────────────────────
 * The sections below ship with this copy and accept an `app_settings`
 * override when one exists (`homepage_standards`, `homepage_education`), so
 * an admin editor can be wired later without touching the components. The
 * routine, goal and ingredient sections are derived from the live catalogue
 * instead: every product's `best_for`, `recommended_stack` and name.
 *
 * Copy is written as general wellness information. Nothing here claims to
 * diagnose, treat, cure or prevent a disease. */

/** "The Formulary standard" — how every formula is made. `icon` keys map to
 *  lucide icons in `components/home/Standard.jsx`. */
export const DEFAULT_STANDARDS = [
    {
        icon: "form",
        title: "Forms that absorb",
        text: "We choose the form of each nutrient for how well the body takes it up: magnesium as glycinate, calcium as citrate, vitamin D as D3. The form is printed on the label, not hidden behind a generic name.",
    },
    {
        icon: "dose",
        title: "Doses that match the label",
        text: "What the label says is what each serving delivers. Every active is listed with its amount per serving, so you can compare it with your daily requirement instead of guessing.",
    },
    {
        icon: "blend",
        title: "No proprietary blends",
        text: "A blend that lists ingredients without amounts tells you nothing. Every Core Atoms formula discloses each ingredient individually, including the herbal extracts.",
    },
    {
        icon: "test",
        title: "Tested batch by batch",
        text: "Each production batch is checked for identity, potency and contaminants before it is released, and the batch number on your pack ties back to that record.",
    },
    {
        icon: "dispatch",
        title: "Packed and dispatched fast",
        text: "Orders are packed and handed to the courier within a business day, tracked door to door, with Cash on Delivery available across India.",
    },
    {
        icon: "claims",
        title: "Honest about what supplements do",
        text: "Supplements support a routine; they do not treat or cure disease. We describe what each nutrient is known for and leave the miracle language to others.",
    },
];

/** "Know your supplements" — four things worth understanding before buying
 *  any supplement, from anyone. `icon` keys map in `components/home/Education.jsx`. */
export const DEFAULT_EDUCATION = [
    {
        icon: "label",
        title: "How to read a supplement label",
        text: "Start with the serving size, then the amount of each active per serving and its share of the daily requirement. Ingredients listed as a blend without amounts are a red flag; every Core Atoms label lists them individually.",
        href: "/faq",
        linkText: "Where to find ingredient details",
    },
    {
        icon: "form",
        title: "Why the form of a nutrient matters",
        text: "Magnesium oxide and magnesium glycinate are both \"magnesium\", yet the body absorbs them very differently and one is far gentler on the stomach. The same goes for calcium citrate versus carbonate, and D3 versus D2. Check the form first.",
        href: "/shop?q=Magnesium",
        linkText: "See our magnesium",
    },
    {
        icon: "timing",
        title: "Timing your doses",
        text: "Fat-soluble nutrients such as vitamin D3 and omega-3 absorb best with a meal that contains some fat. Iron is better taken on its own with vitamin C, away from tea, coffee and calcium. Magnesium and ashwagandha suit the evening. Consistency matters more than the exact hour.",
        href: "/faq",
        linkText: "How to take our formulas",
    },
    {
        icon: "testing",
        title: "What third-party testing checks",
        text: "An independent laboratory verifies that a batch contains what the label claims (identity and potency) and that it is free of heavy metals and microbial contamination (purity). It is the difference between a claim and a certificate.",
        href: "/faq",
        linkText: "Are your products safe?",
    },
];

/** The actives across the catalogue. Each entry matches product names, so a
 *  new formula joins the index the moment it is added. `q` is the shop search
 *  the entry links to. */
export const INGREDIENT_ROLES = [
    { match: /multivitamin/i, name: "Multivitamin", q: "Multivitamin", role: "A daily baseline of vitamins and minerals that fills the everyday gaps in a normal diet." },
    { match: /vitamin\s*d3/i, name: "Vitamin D3", q: "Vitamin D3", role: "The sunshine vitamin in its most usable form, needed to absorb calcium and to keep bones and immunity working." },
    { match: /vitamin\s*c\b/i, name: "Vitamin C", q: "Vitamin C", role: "A water-soluble antioxidant that supports immune defence, iron absorption and the body's own collagen production." },
    { match: /omega/i, name: "Omega-3 (EPA and DHA)", q: "Omega-3", role: "Essential fatty acids from fish oil that support heart, brain and joint health and help balance inflammation." },
    { match: /magnesium\s*glycinate/i, name: "Magnesium glycinate", q: "Magnesium", role: "A gentle, well-absorbed form of magnesium for muscle relaxation, sleep quality and hundreds of enzyme reactions." },
    { match: /calcium/i, name: "Calcium with D3 and K2", q: "Calcium", role: "The mineral backbone of bones and teeth, paired with the cofactors that help the body place it where it belongs." },
    { match: /\bzinc\b/i, name: "Zinc", q: "Zinc", role: "A trace mineral behind immune defence, skin repair and normal taste and smell." },
    { match: /\biron\b/i, name: "Iron and folic acid", q: "Iron", role: "Two nutrients for healthy red blood cells and everyday energy, especially for women of reproductive age." },
    { match: /b[\s-]*complex/i, name: "B-complex", q: "B-Complex", role: "The eight B vitamins that turn food into energy and support the nervous system." },
    { match: /biotin/i, name: "Biotin (vitamin B7)", q: "Biotin", role: "A B vitamin the body uses to make keratin, the protein that hair and nails are built from." },
    { match: /collagen/i, name: "Collagen peptides", q: "Collagen", role: "Hydrolysed protein that supplies the building blocks of skin, hair, nails, cartilage and connective tissue." },
    { match: /probiotic/i, name: "Probiotics", q: "Probiotic", role: "Live cultures that help maintain a balanced gut microbiome, which supports digestion and immune function." },
    { match: /turmeric|curcumin/i, name: "Curcumin", q: "Turmeric", role: "The active compound in turmeric, studied for joint comfort and its role in a healthy inflammatory response." },
    { match: /ashwagandha/i, name: "Ashwagandha", q: "Ashwagandha", role: "An adaptogenic root extract, traditionally used to support the body's response to everyday stress and steady focus." },
];

/**
 * "Shop by goal" chips: the `best_for` tags across the catalogue, ranked by
 * how many formulas carry each ("Immunity" first). Case-insensitive so an
 * admin's "immunity" and "Immunity" count as one goal.
 * @returns {Array<{label:string, count:number}>}
 */
export function deriveGoals(products, limit = 10) {
    const counts = new Map();
    (products || []).forEach((p) => {
        if (p.isActive === false) return;
        String(p.bestFor || "").split(/\s*[•·|,]\s*/).map((s) => s.trim()).filter(Boolean).forEach((goal) => {
            const key = goal.toLowerCase();
            const cur = counts.get(key) || { label: goal, count: 0 };
            cur.count += 1;
            counts.set(key, cur);
        });
    });
    return [...counts.values()]
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, limit);
}

/**
 * "What's inside": the ingredient entries that at least one active formula
 * carries, in curated order, each with its formula count and shop link.
 * @returns {Array<{name:string, role:string, count:number, href:string}>}
 */
export function buildIngredientIndex(products) {
    const active = (products || []).filter((p) => p.isActive !== false);
    return INGREDIENT_ROLES
        .map((entry) => {
            const count = active.filter((p) => entry.match.test(p.name)).length;
            return count > 0
                ? { name: entry.name, role: entry.role, count, href: `/shop?q=${encodeURIComponent(entry.q)}` }
                : null;
        })
        .filter(Boolean);
}

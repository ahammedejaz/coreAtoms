/**
 * AdminHomepage.jsx — Homepage content editor for admins.
 *
 * Allows admins to visually configure every section of the public homepage.
 * All settings are persisted to the `app_settings` table as jsonb values.
 *
 * Editable sections (in display order):
 *   1. Site Logo — navbar logo image
 *   2. Hero Carousel Images — drag-to-reposition, reorder, upload
 *   3. Hero Copy & CTAs — headline, body, buttons, trust icons
 *   4. Value Pillars — the 4 brand pillar cards
 *   5. Featured Products — pin/unpin products to homepage
 *   6. Shop by Category — category tiles with emoji, label, category value
 *   7. Our Philosophy — brand statement section
 *
 * Each section includes inline live preview. Ctrl+S saves all sections at once.
 *
 * @module pages/admin/AdminHomepage
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../services/supabase/client";
import ImagePositionAdjuster from "../../components/ImagePositionAdjuster";
import useKeyboardShortcut from "../../hooks/useKeyboardShortcut";
import { useToast } from "../../context/ToastContext";

const DEFAULT_COPY = {
    headline: "Engineered for",
    headlineAccent: "daily consistency.",
    body: "Modern nutraceuticals designed for real routines. Clean formulas, structured stacks, and a premium experience from checkout to delivery.",
    primaryCta: "Shop all products",
    secondaryCta: "View best sellers",
    trustIcons: [
        { icon: "🧪", label: "Clean labels" },
        { icon: "🚚", label: "COD available" },
        { icon: "📦", label: "Pan-India delivery" },
    ],
};

const DEFAULT_PILLARS = [
    { icon: "✦", title: "Clean Labels", desc: "No fillers, no hidden ingredients. Every formula is fully disclosed." },
    { icon: "◈", title: "Lab Tested", desc: "Third-party verified for potency, purity, and safety." },
    { icon: "⬡", title: "COD Available", desc: "Cash on delivery across India. No prepayment required." },
    { icon: "⌖", title: "Fast Fulfilment", desc: "Orders dispatched within 24 hours from our facility." },
];

const DEFAULT_CATEGORIES = [
    { label: "Multivitamins", emoji: "💊", category: "General Wellness" },
    { label: "Joint Support", emoji: "🦴", category: "Joint Support" },
    { label: "Bone Health", emoji: "🧬", category: "Bone Health" },
    { label: "Hair & Skin", emoji: "✨", category: "HSN" },
    { label: "Gut Health", emoji: "🌿", category: "Gut Health" },
    { label: "Collagen", emoji: "🔬", category: "Collagen" },
];

const DEFAULT_PHILOSOPHY = {
    label: "Our Philosophy",
    heading: "Built like a system,\nnot a trend.",
    body: "Each Core Atoms formulation is designed around consistency — functional ingredients, simplified stacks, and structured support for real-world routines. No inflated claims. No unnecessary fillers. Just premium precision and daily reliability.",
    cta: "Explore the range",
};

// ── Section header component ──────────────────────────────────────────────────
function SectionHeader({ step, title, desc }) {
    return (
        <div className="flex items-start gap-3 mb-5">
            <div className="shrink-0 h-6 w-6 rounded-full bg-[#1e3a5f] text-white text-[11px] font-bold flex items-center justify-center mt-0.5">{step}</div>
            <div>
                <div className="text-sm font-semibold text-stone-900">{title}</div>
                {desc && <div className="text-xs text-stone-400 mt-0.5">{desc}</div>}
            </div>
        </div>
    );
}


// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminHomepage({ products = [] }) {
    const { showToast } = useToast();
    // ── Logo ─────────────────────────────────────────────────────────────────
    const [logoUrl, setLogoUrl] = useState("");
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState("");
    const [logoUploading, setLogoUploading] = useState(false);
    const [logoErr, setLogoErr] = useState("");

    // ── Hero images ──────────────────────────────────────────────────────────
    const [images, setImages] = useState([]);
    const [imgUploading, setImgUploading] = useState(false);
    const [imgErr, setImgErr] = useState("");
    const [adjustingIdx, setAdjustingIdx] = useState(null);

    // ── Hero copy ────────────────────────────────────────────────────────────
    const [headline, setHeadline] = useState(DEFAULT_COPY.headline);
    const [accent, setAccent] = useState(DEFAULT_COPY.headlineAccent);
    const [body, setBody] = useState(DEFAULT_COPY.body);
    const [primaryCta, setPrimaryCta] = useState(DEFAULT_COPY.primaryCta);
    const [secondaryCta, setSecondaryCta] = useState(DEFAULT_COPY.secondaryCta);
    const [trust, setTrust] = useState(DEFAULT_COPY.trustIcons);

    // ── Pillars ──────────────────────────────────────────────────────────────
    const [pillars, setPillars] = useState(DEFAULT_PILLARS);

    // ── Featured products ────────────────────────────────────────────────────
    const [featuredIds, setFeaturedIds] = useState([]);

    // ── Categories ───────────────────────────────────────────────────────────
    const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

    // ── Philosophy ───────────────────────────────────────────────────────────
    const [philoLabel, setPhiloLabel] = useState(DEFAULT_PHILOSOPHY.label);
    const [philoHeading, setPhiloHeading] = useState(DEFAULT_PHILOSOPHY.heading);
    const [philoBody, setPhiloBody] = useState(DEFAULT_PHILOSOPHY.body);
    const [philoCta, setPhiloCta] = useState(DEFAULT_PHILOSOPHY.cta);

    // ── UI ───────────────────────────────────────────────────────────────────
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(true);

    // ── Load ─────────────────────────────────────────────────────────────────
    useEffect(() => { load(); }, []); // eslint-disable-line

    const load = async () => {
        setLoading(true);
        const { data } = await supabase
            .from("app_settings")
            .select("key,value")
            .in("key", [
                "homepage_hero_images", "homepage_hero_copy", "homepage_featured_products",
                "homepage_pillars", "homepage_categories", "homepage_philosophy", "site_logo",
            ]);

        const map = {};
        (data || []).forEach((row) => { map[row.key] = row.value; });

        // Logo
        if (typeof map.site_logo === "string" && map.site_logo) {
            setLogoUrl(map.site_logo);
            setLogoPreview(map.site_logo);
        }

        // Images
        const rawImgs = Array.isArray(map.homepage_hero_images) ? map.homepage_hero_images : [];
        setImages(rawImgs.map((item, i) =>
            typeof item === "string"
                ? { url: item, position: "50% 50%", _key: String(i) }
                : { url: item.url || "", position: item.position || "50% 50%", _key: String(i) }
        ));

        // Hero copy
        const c = map.homepage_hero_copy || {};
        setHeadline(c.headline || DEFAULT_COPY.headline);
        setAccent(c.headlineAccent || DEFAULT_COPY.headlineAccent);
        setBody(c.body || DEFAULT_COPY.body);
        setPrimaryCta(c.primaryCta || DEFAULT_COPY.primaryCta);
        setSecondaryCta(c.secondaryCta || DEFAULT_COPY.secondaryCta);
        if (Array.isArray(c.trustIcons) && c.trustIcons.length === 3) setTrust(c.trustIcons);

        // Pillars
        if (Array.isArray(map.homepage_pillars) && map.homepage_pillars.length > 0) setPillars(map.homepage_pillars);

        // Featured
        setFeaturedIds(Array.isArray(map.homepage_featured_products) ? map.homepage_featured_products : []);

        // Categories
        if (Array.isArray(map.homepage_categories) && map.homepage_categories.length > 0) setCategories(map.homepage_categories);

        // Philosophy
        const ph = map.homepage_philosophy || {};
        setPhiloLabel(ph.label || DEFAULT_PHILOSOPHY.label);
        setPhiloHeading(ph.heading || DEFAULT_PHILOSOPHY.heading);
        setPhiloBody(ph.body || DEFAULT_PHILOSOPHY.body);
        setPhiloCta(ph.cta || DEFAULT_PHILOSOPHY.cta);

        setLoading(false);
    };

    // ── Keyboard shortcut: Ctrl+S to save ────────────────────────────────────
    const saveRef = useRef(null);
    const handleCtrlS = useCallback((e) => { e.preventDefault(); saveRef.current?.(); }, []);
    useKeyboardShortcut("ctrl+s", handleCtrlS);

    // ── Save ─────────────────────────────────────────────────────────────────
    const save = async () => {
        setSaving(true);
        setMsg("");
        setImgErr("");
        setLogoErr("");
        try {
            // 1. Upload logo if new
            let finalLogoUrl = logoUrl;
            if (logoFile) {
                setLogoUploading(true);
                const ext = logoFile.name.split(".").pop();
                const path = `logo/site_logo_${Date.now()}.${ext}`;
                const { error: upErr } = await supabase.storage.from("hero-images").upload(path, logoFile, { cacheControl: "3600", upsert: true });
                setLogoUploading(false);
                if (upErr) { setLogoErr(upErr.message); setSaving(false); return; }
                const { data: pd } = supabase.storage.from("hero-images").getPublicUrl(path);
                finalLogoUrl = pd?.publicUrl || "";
                setLogoUrl(finalLogoUrl);
                setLogoFile(null);
            }

            // 2. Upload new hero images
            const finalImages = [];
            for (const img of images) {
                if (img._file) {
                    setImgUploading(true);
                    const ext = img._file.name.split(".").pop();
                    const path = `hero/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                    const { error: upErr } = await supabase.storage.from("hero-images").upload(path, img._file, { cacheControl: "3600", upsert: false });
                    setImgUploading(false);
                    if (upErr) { setImgErr(upErr.message); setSaving(false); return; }
                    const { data: pd } = supabase.storage.from("hero-images").getPublicUrl(path);
                    finalImages.push({ url: pd?.publicUrl || "", position: img.position || "50% 50%" });
                } else if (img.url) {
                    finalImages.push({ url: img.url, position: img.position || "50% 50%" });
                }
            }

            // 3. Upsert all
            const upsert = (key, value) => supabase.from("app_settings").upsert({ key, value }, { onConflict: "key" });
            const results = await Promise.all([
                upsert("site_logo", finalLogoUrl),
                upsert("homepage_hero_images", finalImages),
                upsert("homepage_hero_copy", { headline, headlineAccent: accent, body, primaryCta, secondaryCta, trustIcons: trust }),
                upsert("homepage_pillars", pillars),
                upsert("homepage_featured_products", featuredIds),
                upsert("homepage_categories", categories),
                upsert("homepage_philosophy", { label: philoLabel, heading: philoHeading, body: philoBody, cta: philoCta }),
            ]);

            const err = results.find((r) => r.error)?.error;
            if (err) { setMsg(`Save failed: ${err.message}`); showToast(err.message, "error"); setSaving(false); return; }

            setImages(finalImages.map((img, i) => ({ ...img, _key: String(i) })));
            setMsg("Saved ✅ — all changes are live.");
            showToast("Homepage saved — all changes are live", "success");
        } catch (e) {
            setMsg(e?.message || "Save failed");
            showToast(e?.message || "Save failed", "error");
        } finally {
            setSaving(false);
        }
    };
    saveRef.current = save;

    if (loading) return (
        <div className="py-10 text-center text-sm text-stone-400 animate-pulse">Loading homepage settings…</div>
    );

    return (
        <div className="space-y-5 max-w-4xl">

            {/* ── Sticky save bar ── */}
            <div className="sticky top-0 z-20 -mx-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#E8E4DE] bg-white/90 backdrop-blur px-4 sm:px-5 py-3 shadow-sm">
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-stone-900">Homepage Editor</div>
                    <div className="text-xs text-stone-400 hidden sm:block">Editing sections below in order — matches your live homepage layout.</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {msg && <span className={`text-xs sm:text-sm truncate max-w-[180px] sm:max-w-none ${msg.includes("failed") ? "text-red-600" : "text-emerald-600"}`}>{msg}</span>}
                    <button type="button" onClick={save} disabled={saving} className="btn-primary disabled:opacity-50 px-5 py-2 text-sm">
                        {saving ? "Saving…" : "Save all"}
                    </button>
                </div>
            </div>

            {/* ══ 1 · SITE LOGO ══════════════════════════════════════════════ */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white p-6">
                <SectionHeader step="1" title="Site Logo" desc="Shown in the navbar. Falls back to the CA text mark if not set." />
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
                    <div className="shrink-0 h-20 w-44 rounded-xl border border-[#E8E4DE] bg-stone-50 flex items-center justify-center overflow-hidden">
                        {logoPreview ? (
                            <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-3" />
                        ) : (
                            <div className="text-center">
                                <div className="h-9 w-9 rounded-xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-100 grid place-items-center shadow-sm mx-auto">
                                    <span className="text-xs font-semibold text-neutral-900">CA</span>
                                </div>
                                <div className="text-[10px] text-stone-400 mt-1">Default</div>
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="text-xs text-stone-500 mb-3">{logoUrl ? "Logo active — upload to replace." : "No logo set — using default CA mark."}</div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <label className="cursor-pointer rounded-xl border border-[#E8E4DE] bg-stone-50 hover:border-[#1e3a5f]/40 hover:bg-[#EFF6FF] px-4 py-2 text-xs font-medium text-stone-700 transition">
                                {logoFile ? `✓ ${logoFile.name}` : "Choose logo file"}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); e.target.value = ""; }} />
                            </label>
                            {(logoFile || logoUrl) && (
                                <button type="button" onClick={() => { setLogoFile(null); setLogoUrl(""); setLogoPreview(""); }} className="text-xs text-red-500 hover:underline">Remove</button>
                            )}
                        </div>
                        {logoErr && <div className="mt-2 text-xs text-red-600">{logoErr}</div>}
                        {logoUploading && <div className="mt-2 text-xs text-stone-400 animate-pulse">Uploading…</div>}
                    </div>
                </div>
            </div>

            {/* ══ 2 · HERO IMAGES ════════════════════════════════════════════ */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white p-6">
                <SectionHeader step="2" title="Hero Carousel Images" desc="Upload images. Hover → Adjust to drag-reposition each image within the carousel frame." />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                    {images.map((img, i) => (
                        <div key={img._key || i} className="relative group rounded-xl overflow-hidden border border-[#E8E4DE] bg-stone-50" style={{ aspectRatio: "4/3" }}>
                            <img src={img._preview || img.url} alt={`Slide ${i + 1}`} className="h-full w-full object-cover" style={{ objectPosition: img.position || "50% 50%" }} />
                            <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-black/50 text-white text-[10px] font-bold flex items-center justify-center pointer-events-none">{i + 1}</div>
                            {img._file && <div className="absolute top-2 right-2 rounded-full bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 pointer-events-none">NEW</div>}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                <button type="button" onClick={() => setAdjustingIdx(i)}
                                    className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-stone-800 hover:bg-white shadow">
                                    ⊹ Adjust
                                </button>
                                <div className="flex items-center gap-1.5">
                                    {i > 0 && <button type="button" onClick={() => { const a = [...images];[a[i - 1], a[i]] = [a[i], a[i - 1]]; setImages(a); }} className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center text-stone-700 hover:bg-white shadow text-sm">←</button>}
                                    {i < images.length - 1 && <button type="button" onClick={() => { const a = [...images];[a[i], a[i + 1]] = [a[i + 1], a[i]]; setImages(a); }} className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center text-stone-700 hover:bg-white shadow text-sm">→</button>}
                                    <button type="button" onClick={() => setImages((p) => p.filter((_, j) => j !== i))} className="h-7 w-7 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 shadow">
                                        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    <label className="relative rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 hover:border-[#1e3a5f] hover:bg-[#EFF6FF] cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 text-stone-400 hover:text-[#1e3a5f]" style={{ aspectRatio: "4/3" }}>
                        <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        <span className="text-[11px] font-medium text-center px-2">Add image</span>
                        <input type="file" accept="image/*" multiple className="hidden"
                            onChange={(e) => { const files = Array.from(e.target.files || []); setImages((p) => [...p, ...files.map((f) => ({ url: "", position: "50% 50%", _file: f, _preview: URL.createObjectURL(f), _key: `new_${Date.now()}_${Math.random()}` }))]); e.target.value = ""; }} />
                    </label>
                </div>
                {imgErr && <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600 mb-2">{imgErr}</div>}
                {imgUploading && <div className="text-xs text-stone-400 animate-pulse mb-2">Uploading image…</div>}
            </div>

            {/* ══ 3 · HERO COPY ══════════════════════════════════════════════ */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white p-6">
                <SectionHeader step="3" title="Hero Copy & CTAs" desc="Headline, body text, buttons, and the 3 trust icons below the CTAs." />
                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <div className="text-xs text-stone-400 mb-1">Headline (line 1)</div>
                            <input value={headline} onChange={(e) => setHeadline(e.target.value)} className="w-full rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                        </div>
                        <div>
                            <div className="text-xs text-stone-400 mb-1">Headline accent — navy (line 2)</div>
                            <input value={accent} onChange={(e) => setAccent(e.target.value)} className="w-full rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-stone-400 mb-1">Body text</div>
                        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="w-full rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none resize-none" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <div className="text-xs text-stone-400 mb-1">Primary CTA button</div>
                            <input value={primaryCta} onChange={(e) => setPrimaryCta(e.target.value)} className="w-full rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                        </div>
                        <div>
                            <div className="text-xs text-stone-400 mb-1">Secondary CTA button</div>
                            <input value={secondaryCta} onChange={(e) => setSecondaryCta(e.target.value)} className="w-full rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-stone-400 mb-2">Trust icons (3 shown below CTAs)</div>
                        <div className="grid gap-2 sm:grid-cols-3">
                            {trust.map((t, i) => (
                                <div key={i} className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2">
                                    <input value={t.icon} onChange={(e) => setTrust((p) => p.map((x, j) => j === i ? { ...x, icon: e.target.value } : x))} className="w-10 text-center rounded-lg border border-[#E8E4DE] bg-white px-1 py-1 text-base outline-none" />
                                    <input value={t.label} onChange={(e) => setTrust((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} className="flex-1 rounded-lg border border-[#E8E4DE] bg-white px-2 py-1 text-xs text-stone-900 outline-none" placeholder="Label" />
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Live preview */}
                    <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-4">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-3">Live preview</div>
                        <div className="text-2xl font-semibold tracking-tight text-stone-900 leading-snug">{headline || "—"}<br /><span className="text-[#1e3a5f]">{accent || "—"}</span></div>
                        <p className="mt-2 text-[13px] text-stone-500 leading-relaxed max-w-sm">{body}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-xl bg-[#1e3a5f] text-white px-4 py-1.5 text-xs font-semibold">{primaryCta}</span>
                            <span className="rounded-xl border border-[#E8E4DE] bg-white text-stone-700 px-4 py-1.5 text-xs font-semibold">{secondaryCta} →</span>
                        </div>
                        <div className="mt-4 flex gap-5">{trust.slice(0, 3).map((t) => (<div key={t.label} className="text-center"><div className="text-lg">{t.icon}</div><div className="text-[10px] text-stone-500 mt-0.5">{t.label}</div></div>))}</div>
                    </div>
                </div>
            </div>

            {/* ══ 4 · PILLARS (Clean Labels etc.) ═══════════════════════════ */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white p-6">
                <SectionHeader step="4" title="Value Pillars" desc='The 4 cards shown below the hero — "Clean Labels", "Lab Tested", etc.' />
                <div className="space-y-3">
                    {pillars.map((p, i) => (
                        <div key={i} className="grid gap-2 grid-cols-1 sm:grid-cols-[48px_1fr_2fr_32px] items-start sm:items-center rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5">
                            <input value={p.icon} onChange={(e) => setPillars((prev) => prev.map((x, j) => j === i ? { ...x, icon: e.target.value } : x))}
                                className="w-10 text-center rounded-lg border border-[#E8E4DE] bg-white px-1 py-1.5 text-lg outline-none" title="Icon/emoji" />
                            <input value={p.title} onChange={(e) => setPillars((prev) => prev.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                                className="rounded-lg border border-[#E8E4DE] bg-white px-2 py-1.5 text-sm font-semibold text-stone-900 outline-none" placeholder="Title" />
                            <input value={p.desc} onChange={(e) => setPillars((prev) => prev.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))}
                                className="rounded-lg border border-[#E8E4DE] bg-white px-2 py-1.5 text-xs text-stone-600 outline-none" placeholder="Description" />
                            <button type="button" onClick={() => setPillars((prev) => prev.filter((_, j) => j !== i))}
                                className="h-7 w-7 rounded-lg border border-red-200 bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center text-xs">✕</button>
                        </div>
                    ))}
                    <button type="button" onClick={() => setPillars((p) => [...p, { icon: "✦", title: "", desc: "" }])}
                        className="w-full rounded-xl border-2 border-dashed border-stone-300 py-2 text-xs font-medium text-stone-400 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition">
                        + Add pillar
                    </button>
                </div>
            </div>

            {/* ══ 5 · FEATURED PRODUCTS ══════════════════════════════════════ */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white p-6">
                <SectionHeader step="5" title="Featured Products" desc="Pin products to the homepage. If none pinned, first 6 active products show automatically." />
                {featuredIds.length > 0 && (
                    <div className="mb-5">
                        <div className="text-xs font-semibold text-stone-600 mb-2">Pinned ({featuredIds.length})</div>
                        <div className="space-y-2">
                            {featuredIds.map((pid, i) => {
                                const p = products.find((x) => x.id === pid);
                                if (!p) return null;
                                return (
                                    <div key={pid} className="flex items-center gap-3 rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2">
                                        <span className="h-5 w-5 rounded-full bg-[#1e3a5f] text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                                        {p.image_url && <img src={p.image_url} alt={p.name} className="h-9 w-9 rounded-lg object-cover shrink-0 border border-[#E8E4DE]" />}
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold text-stone-900 truncate">{p.name}</div>
                                            <div className="text-xs text-stone-400">{p.category} · ₹{Number(p.price_inr || 0).toLocaleString("en-IN")}</div>
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            <button type="button" disabled={i === 0} onClick={() => setFeaturedIds((p) => { const a = [...p];[a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; })} className="h-6 w-6 rounded-lg border border-[#E8E4DE] bg-white text-stone-400 hover:text-stone-700 disabled:opacity-30 text-xs flex items-center justify-center">↑</button>
                                            <button type="button" disabled={i === featuredIds.length - 1} onClick={() => setFeaturedIds((p) => { const a = [...p];[a[i], a[i + 1]] = [a[i + 1], a[i]]; return a; })} className="h-6 w-6 rounded-lg border border-[#E8E4DE] bg-white text-stone-400 hover:text-stone-700 disabled:opacity-30 text-xs flex items-center justify-center">↓</button>
                                            <button type="button" onClick={() => setFeaturedIds((p) => p.filter((x) => x !== pid))} className="h-6 w-6 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 text-xs flex items-center justify-center">✕</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                <div>
                    <div className="text-xs font-semibold text-stone-600 mb-2">
                        {products.filter((p) => !featuredIds.includes(p.id)).length > 0 ? "All products — click to pin" : "All products are pinned"}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {products.filter((p) => !featuredIds.includes(p.id)).map((p) => (
                            <button key={p.id} type="button" onClick={() => setFeaturedIds((prev) => [...prev, p.id])}
                                className="flex items-center gap-3 rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-left hover:border-[#1e3a5f]/40 hover:bg-[#EFF6FF] transition group">
                                {p.image_url && <img src={p.image_url} alt={p.name} className="h-9 w-9 rounded-lg object-cover shrink-0 border border-[#E8E4DE]" />}
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-stone-800 truncate group-hover:text-[#1e3a5f]">{p.name}</div>
                                    <div className="text-xs text-stone-400">{p.category} · ₹{Number(p.price_inr || 0).toLocaleString("en-IN")}</div>
                                </div>
                                <svg className="h-4 w-4 text-stone-300 group-hover:text-[#1e3a5f] shrink-0 transition" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ══ 6 · CATEGORIES ═════════════════════════════════════════════ */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white p-6">
                <SectionHeader step="6" title="Shop by Category" desc="The category tiles shown on the homepage. The 'Category' value must match your product categories exactly." />
                <div className="space-y-2 mb-3">
                    {categories.map((cat, i) => (
                        <div key={i} className="grid gap-2 grid-cols-1 sm:grid-cols-[48px_1fr_1fr_32px] items-start sm:items-center rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5">
                            <input value={cat.emoji} onChange={(e) => setCategories((prev) => prev.map((x, j) => j === i ? { ...x, emoji: e.target.value } : x))}
                                className="w-10 text-center rounded-lg border border-[#E8E4DE] bg-white px-1 py-1.5 text-lg outline-none" title="Emoji" />
                            <input value={cat.label} onChange={(e) => setCategories((prev) => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                                className="rounded-lg border border-[#E8E4DE] bg-white px-2 py-1.5 text-sm font-semibold text-stone-900 outline-none" placeholder="Display label" />
                            <input value={cat.category} onChange={(e) => setCategories((prev) => prev.map((x, j) => j === i ? { ...x, category: e.target.value } : x))}
                                className="rounded-lg border border-[#E8E4DE] bg-white px-2 py-1.5 text-xs text-stone-500 outline-none font-mono" placeholder="Product category value" title="Must match the category field in your products" />
                            <button type="button" onClick={() => setCategories((prev) => prev.filter((_, j) => j !== i))}
                                className="h-7 w-7 rounded-lg border border-red-200 bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center text-xs">✕</button>
                        </div>
                    ))}
                    <button type="button" onClick={() => setCategories((p) => [...p, { emoji: "💊", label: "", category: "" }])}
                        className="w-full rounded-xl border-2 border-dashed border-stone-300 py-2 text-xs font-medium text-stone-400 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition">
                        + Add category
                    </button>
                </div>
                {/* Preview */}
                <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-3">Preview</div>
                    <div className="flex flex-wrap gap-2">
                        {categories.map((cat, i) => (
                            <div key={i} className="flex flex-col items-center gap-1.5 rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-center min-w-[64px]">
                                <div className="h-9 w-9 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-xl">{cat.emoji}</div>
                                <span className="text-[11px] font-semibold text-stone-700 leading-snug">{cat.label || "—"}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ══ 7 · PHILOSOPHY ═════════════════════════════════════════════ */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white p-6">
                <SectionHeader step="7" title="Our Philosophy Section" desc="The large centered brand statement card at the bottom of the homepage." />
                <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <div className="text-xs text-stone-400 mb-1">Section label (small caps above heading)</div>
                            <input value={philoLabel} onChange={(e) => setPhiloLabel(e.target.value)} className="w-full rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" placeholder="e.g. Our Philosophy" />
                        </div>
                        <div>
                            <div className="text-xs text-stone-400 mb-1">CTA button text</div>
                            <input value={philoCta} onChange={(e) => setPhiloCta(e.target.value)} className="w-full rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" placeholder="e.g. Explore the range" />
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-stone-400 mb-1">Heading — use \n for line break</div>
                        <textarea value={philoHeading} onChange={(e) => setPhiloHeading(e.target.value)} rows={2}
                            className="w-full rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none resize-none" />
                    </div>
                    <div>
                        <div className="text-xs text-stone-400 mb-1">Body text</div>
                        <textarea value={philoBody} onChange={(e) => setPhiloBody(e.target.value)} rows={4}
                            className="w-full rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none resize-none" />
                    </div>
                    {/* Preview */}
                    <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-5 text-center">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-3">Preview</div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">{philoLabel}</p>
                        <h3 className="text-xl font-semibold tracking-tight text-stone-900 leading-snug whitespace-pre-line">{philoHeading}</h3>
                        <p className="mt-3 text-[13px] text-stone-500 leading-relaxed max-w-lg mx-auto">{philoBody}</p>
                        <div className="mt-4 inline-flex rounded-xl bg-[#1e3a5f] text-white px-5 py-2 text-xs font-semibold">{philoCta}</div>
                    </div>
                </div>
            </div>

            {/* Bottom save */}
            <div className="flex items-center justify-end gap-3 pb-6">
                {msg && <span className={`text-sm ${msg.includes("failed") ? "text-red-600" : "text-emerald-600"}`}>{msg}</span>}
                <button type="button" onClick={save} disabled={saving} className="btn-primary disabled:opacity-50 px-6 py-2.5">
                    {saving ? "Saving…" : "Save all"}
                </button>
            </div>

            {/* Position adjuster modal */}
            {adjustingIdx !== null && images[adjustingIdx] && (
                <ImagePositionAdjuster
                    src={images[adjustingIdx]._preview || images[adjustingIdx].url}
                    position={images[adjustingIdx].position}
                    onSave={(position) => setImages((prev) => prev.map((img, i) => i === adjustingIdx ? { ...img, position } : img))}
                    onClose={() => setAdjustingIdx(null)}
                />
            )}
        </div>
    );
}

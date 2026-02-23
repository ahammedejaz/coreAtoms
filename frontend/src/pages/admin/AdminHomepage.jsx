import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";

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

export default function AdminHomepage({ products = [] }) {
    // Images
    const [images, setImages]           = useState([]);
    const [imgUploading, setImgUploading] = useState(false);
    const [imgErr, setImgErr]           = useState("");
    // Copy
    const [headline, setHeadline]       = useState(DEFAULT_COPY.headline);
    const [accent, setAccent]           = useState(DEFAULT_COPY.headlineAccent);
    const [body, setBody]               = useState(DEFAULT_COPY.body);
    const [primaryCta, setPrimaryCta]   = useState(DEFAULT_COPY.primaryCta);
    const [secondaryCta, setSecondaryCta] = useState(DEFAULT_COPY.secondaryCta);
    const [trust, setTrust]             = useState(DEFAULT_COPY.trustIcons);
    // Featured products
    const [featuredIds, setFeaturedIds] = useState([]);
    // Save state
    const [saving, setSaving]           = useState(false);
    const [msg, setMsg]                 = useState("");
    const [loading, setLoading]         = useState(true);

    // ── Load on mount ────────────────────────────────────────────────────────
    useEffect(() => { load(); }, []); // eslint-disable-line

    const load = async () => {
        setLoading(true);
        setMsg("");
        const { data, error } = await supabase
            .from("app_settings")
            .select("key,value")
            .in("key", ["homepage_hero_images", "homepage_hero_copy", "homepage_featured_products"]);

        if (error) { setLoading(false); return; }

        const map = {};
        (data || []).forEach((row) => { map[row.key] = row.value; });

        // Images
        const imgs = Array.isArray(map.homepage_hero_images) ? map.homepage_hero_images : [];
        setImages(imgs.map((url, i) => ({ url, _key: String(i) })));

        // Copy
        const c = map.homepage_hero_copy || {};
        setHeadline(c.headline || DEFAULT_COPY.headline);
        setAccent(c.headlineAccent || DEFAULT_COPY.headlineAccent);
        setBody(c.body || DEFAULT_COPY.body);
        setPrimaryCta(c.primaryCta || DEFAULT_COPY.primaryCta);
        setSecondaryCta(c.secondaryCta || DEFAULT_COPY.secondaryCta);
        if (Array.isArray(c.trustIcons) && c.trustIcons.length === 3) setTrust(c.trustIcons);

        // Featured
        setFeaturedIds(Array.isArray(map.homepage_featured_products) ? map.homepage_featured_products : []);
        setLoading(false);
    };

    // ── Save ─────────────────────────────────────────────────────────────────
    const save = async () => {
        setSaving(true);
        setMsg("");
        setImgErr("");
        try {
            // 1. Upload any new files
            const finalImages = [];
            for (const img of images) {
                if (img._file) {
                    setImgUploading(true);
                    const ext = img._file.name.split(".").pop();
                    const path = `hero/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                    const { error: upErr } = await supabase.storage
                        .from("hero-images")
                        .upload(path, img._file, { cacheControl: "3600", upsert: false });
                    setImgUploading(false);
                    if (upErr) { setImgErr(upErr.message); setSaving(false); return; }
                    const { data: pd } = supabase.storage.from("hero-images").getPublicUrl(path);
                    finalImages.push(pd?.publicUrl || "");
                } else if (img.url) {
                    finalImages.push(img.url);
                }
            }

            // 2. Persist using upsert — works whether or not the row exists yet
            const upsertRow = (key, value) =>
                supabase.from("app_settings")
                    .upsert({ key, value }, { onConflict: "key" });

            const [r1, r2, r3] = await Promise.all([
                upsertRow("homepage_hero_images", finalImages),
                upsertRow("homepage_hero_copy", {
                    headline, headlineAccent: accent, body,
                    primaryCta, secondaryCta, trustIcons: trust,
                }),
                upsertRow("homepage_featured_products", featuredIds),
            ]);

            // Surface the first error we find
            const err = r1.error || r2.error || r3.error;
            if (err) { setMsg(`Save failed: ${err.message}`); setSaving(false); return; }

            // Update local images to replace _file refs
            setImages(finalImages.map((url, i) => ({ url, _key: String(i) })));
            setMsg("Saved ✅ — changes are live on the homepage.");
        } catch (e) {
            setMsg(e?.message || "Save failed");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="py-10 text-center text-sm text-stone-400 animate-pulse">Loading homepage settings…</div>;
    }

    return (
        <div className="space-y-6 max-w-4xl">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-base font-semibold text-stone-900">Homepage Editor</div>
                    <div className="text-xs text-stone-400 mt-0.5">Changes go live immediately after saving.</div>
                </div>
                <div className="flex items-center gap-3">
                    {msg && <span className={`text-sm ${msg.includes("failed") ? "text-red-600" : "text-emerald-600"}`}>{msg}</span>}
                    <button type="button" onClick={save} disabled={saving} className="btn-primary disabled:opacity-50 px-5 py-2.5">
                        {saving ? "Saving…" : "Save homepage"}
                    </button>
                </div>
            </div>

            {/* ══ CARD 1: Hero Carousel Images ══ */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white p-6">
                <div className="flex items-center gap-2 mb-1">
                    <svg className="h-4 w-4 text-[#1e3a5f]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/></svg>
                    <div className="text-sm font-semibold text-stone-900">Hero Carousel Images</div>
                </div>
                <div className="text-xs text-stone-400 mb-5">
                    Manage the sliding hero images. Hover to reorder or remove. Click "Add image" to upload new ones.
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                    {images.map((img, i) => (
                        <div
                            key={img._key || i}
                            className="relative group rounded-xl overflow-hidden border border-[#E8E4DE] bg-stone-50"
                            style={{ aspectRatio: "4/3" }}
                        >
                            <img src={img._preview || img.url} alt={`Slide ${i + 1}`} className="h-full w-full object-cover" />
                            {/* Slide number */}
                            <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-black/50 text-white text-[10px] font-bold flex items-center justify-center pointer-events-none">
                                {i + 1}
                            </div>
                            {img._file && (
                                <div className="absolute top-2 right-2 rounded-full bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 pointer-events-none">NEW</div>
                            )}
                            {/* Hover controls */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                {i > 0 && (
                                    <button type="button" onClick={() => { const a = [...images]; [a[i-1],a[i]]=[a[i],a[i-1]]; setImages(a); }}
                                        className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center text-stone-700 hover:bg-white shadow text-sm">←</button>
                                )}
                                {i < images.length - 1 && (
                                    <button type="button" onClick={() => { const a = [...images]; [a[i],a[i+1]]=[a[i+1],a[i]]; setImages(a); }}
                                        className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center text-stone-700 hover:bg-white shadow text-sm">→</button>
                                )}
                                <button type="button" onClick={() => setImages((p) => p.filter((_,j) => j !== i))}
                                    className="h-7 w-7 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 shadow">
                                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Upload tile */}
                    <label className="relative rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 hover:border-[#1e3a5f] hover:bg-[#EFF6FF] cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 text-stone-400 hover:text-[#1e3a5f]" style={{ aspectRatio: "4/3" }}>
                        <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
                        <span className="text-[11px] font-medium text-center px-2">Add image</span>
                        <input type="file" accept="image/*" multiple className="hidden"
                            onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                setImages((p) => [...p, ...files.map((f) => ({
                                    url: "", _file: f,
                                    _preview: URL.createObjectURL(f),
                                    _key: `new_${Date.now()}_${Math.random()}`,
                                }))]);
                                e.target.value = "";
                            }}
                        />
                    </label>
                </div>

                {imgErr && <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600 mb-2">{imgErr}</div>}
                {imgUploading && <div className="text-xs text-stone-400 animate-pulse mb-2">Uploading…</div>}
                <div className="text-[11px] text-stone-400 flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-[#1e3a5f] shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg>
                    Uploads go to Supabase Storage bucket <strong className="text-stone-600 mx-0.5">hero-images</strong> (must be public).
                </div>
            </div>

            {/* ══ CARD 2: Hero Copy ══ */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white p-6">
                <div className="flex items-center gap-2 mb-1">
                    <svg className="h-4 w-4 text-[#1e3a5f]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/></svg>
                    <div className="text-sm font-semibold text-stone-900">Hero Copy</div>
                </div>
                <div className="text-xs text-stone-400 mb-5">Edit the headline, body text, and buttons shown beside the carousel.</div>

                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <div className="text-xs text-stone-400 mb-1">Headline (line 1)</div>
                            <input value={headline} onChange={(e) => setHeadline(e.target.value)}
                                className="w-full rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                placeholder="e.g. Engineered for" />
                        </div>
                        <div>
                            <div className="text-xs text-stone-400 mb-1">Headline accent — line 2 (navy colour)</div>
                            <input value={accent} onChange={(e) => setAccent(e.target.value)}
                                className="w-full rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                placeholder="e.g. daily consistency." />
                        </div>
                    </div>

                    <div>
                        <div className="text-xs text-stone-400 mb-1">Body text</div>
                        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3}
                            className="w-full rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none resize-none" />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <div className="text-xs text-stone-400 mb-1">Primary CTA button</div>
                            <input value={primaryCta} onChange={(e) => setPrimaryCta(e.target.value)}
                                className="w-full rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                placeholder="e.g. Shop all products" />
                        </div>
                        <div>
                            <div className="text-xs text-stone-400 mb-1">Secondary CTA button</div>
                            <input value={secondaryCta} onChange={(e) => setSecondaryCta(e.target.value)}
                                className="w-full rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                placeholder="e.g. View best sellers" />
                        </div>
                    </div>

                    <div>
                        <div className="text-xs text-stone-400 mb-2">Trust icons (3 shown below headline)</div>
                        <div className="grid gap-2 sm:grid-cols-3">
                            {trust.map((t, i) => (
                                <div key={i} className="flex items-center gap-2 rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2">
                                    <input value={t.icon}
                                        onChange={(e) => setTrust((p) => p.map((x,j) => j===i ? {...x,icon:e.target.value} : x))}
                                        className="w-10 text-center rounded-lg border border-[#E8E4DE] bg-white px-1 py-1 text-base outline-none" />
                                    <input value={t.label}
                                        onChange={(e) => setTrust((p) => p.map((x,j) => j===i ? {...x,label:e.target.value} : x))}
                                        className="flex-1 rounded-lg border border-[#E8E4DE] bg-white px-2 py-1 text-xs text-stone-900 outline-none"
                                        placeholder="Label" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Live preview */}
                    <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-4">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-3">Preview</div>
                        <div className="text-2xl font-semibold tracking-tight text-stone-900 leading-snug">
                            {headline || "—"}<br />
                            <span className="text-[#1e3a5f]">{accent || "—"}</span>
                        </div>
                        <p className="mt-2 text-[13px] text-stone-500 leading-relaxed max-w-sm">{body}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-xl bg-[#1e3a5f] text-white px-4 py-1.5 text-xs font-semibold">{primaryCta || "CTA 1"}</span>
                            <span className="rounded-xl border border-[#E8E4DE] bg-white text-stone-700 px-4 py-1.5 text-xs font-semibold">{secondaryCta || "CTA 2"} →</span>
                        </div>
                        <div className="mt-4 flex gap-5">
                            {trust.slice(0, 3).map((t) => (
                                <div key={t.label} className="text-center">
                                    <div className="text-lg">{t.icon}</div>
                                    <div className="text-[10px] text-stone-500 mt-0.5">{t.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ══ CARD 3: Featured Products ══ */}
            <div className="rounded-2xl border border-[#E8E4DE] bg-white p-6">
                <div className="flex items-center gap-2 mb-1">
                    <svg className="h-4 w-4 text-[#1e3a5f]" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                    <div className="text-sm font-semibold text-stone-900">Featured Products</div>
                </div>
                <div className="text-xs text-stone-400 mb-5">
                    Pin specific products to show in the Featured section. If none are pinned, the first 6 active products show automatically.
                </div>

                {/* Pinned list */}
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
                                            <button type="button" disabled={i === 0}
                                                onClick={() => setFeaturedIds((p) => { const a=[...p]; [a[i-1],a[i]]=[a[i],a[i-1]]; return a; })}
                                                className="h-6 w-6 rounded-lg border border-[#E8E4DE] bg-white text-stone-400 hover:text-stone-700 disabled:opacity-30 text-xs flex items-center justify-center">↑</button>
                                            <button type="button" disabled={i === featuredIds.length - 1}
                                                onClick={() => setFeaturedIds((p) => { const a=[...p]; [a[i],a[i+1]]=[a[i+1],a[i]]; return a; })}
                                                className="h-6 w-6 rounded-lg border border-[#E8E4DE] bg-white text-stone-400 hover:text-stone-700 disabled:opacity-30 text-xs flex items-center justify-center">↓</button>
                                            <button type="button"
                                                onClick={() => setFeaturedIds((p) => p.filter((x) => x !== pid))}
                                                className="h-6 w-6 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 text-xs flex items-center justify-center">✕</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Product picker */}
                <div>
                    <div className="text-xs font-semibold text-stone-600 mb-2">
                        {products.filter((p) => !featuredIds.includes(p.id)).length > 0
                            ? "All products — click to pin"
                            : "All products are pinned"}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {products.filter((p) => !featuredIds.includes(p.id)).map((p) => (
                            <button key={p.id} type="button"
                                onClick={() => setFeaturedIds((prev) => [...prev, p.id])}
                                className="flex items-center gap-3 rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-left hover:border-[#1e3a5f]/40 hover:bg-[#EFF6FF] transition group"
                            >
                                {p.image_url && <img src={p.image_url} alt={p.name} className="h-9 w-9 rounded-lg object-cover shrink-0 border border-[#E8E4DE]" />}
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-stone-800 truncate group-hover:text-[#1e3a5f]">{p.name}</div>
                                    <div className="text-xs text-stone-400">{p.category} · ₹{Number(p.price_inr || 0).toLocaleString("en-IN")}</div>
                                </div>
                                <svg className="h-4 w-4 text-stone-300 group-hover:text-[#1e3a5f] shrink-0 transition" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom save */}
            <div className="flex items-center justify-end gap-3 pb-4">
                {msg && <span className={`text-sm ${msg.includes("failed") ? "text-red-600" : "text-emerald-600"}`}>{msg}</span>}
                <button type="button" onClick={save} disabled={saving} className="btn-primary disabled:opacity-50 px-6 py-2.5">
                    {saving ? "Saving…" : "Save homepage"}
                </button>
            </div>
        </div>
    );
}

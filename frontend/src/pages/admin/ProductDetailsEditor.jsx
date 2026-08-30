/**
 * ProductDetailsEditor.jsx — Structured editor for the PDP's rich sections.
 *
 * Edits the `products.details` JSONB: key benefits (icon + title + text),
 * key ingredients (name / amount / purpose), how-to-use steps, FAQs and
 * safety info. Renders on the customer product page as Centrum/1mg-style
 * sections; empty sections simply don't render there.
 *
 * Also exports `organiseAboutText()` — the "Auto-organise" importer that
 * takes a monograph pasted into About text, detects section headings
 * (Key Ingredients / Key Benefits / Directions / Caution / FAQs), and moves
 * their content into the structured fields, leaving the story text behind.
 *
 * @module pages/admin/ProductDetailsEditor
 */
import BenefitIcon, { ICON_OPTIONS } from "../../components/BenefitIcon";

/* ── Auto-organise: monograph → structured sections ─────────────────────── */

const SECTION_MAP = [
    { key: "ingredients", rx: /^(key\s+ingredients?|ingredients?|what'?s\s+inside)[:]?$/i },
    { key: "benefits", rx: /^(key\s+benefits?|benefits?)[:]?$/i },
    { key: "howToUse", rx: /^(how\s+to\s+use|directions?(\s+for\s+use)?|dosage|recommended\s+usage)[:]?$/i },
    { key: "safety", rx: /^(caution|warnings?|safety(\s+information)?|disclaimer|precautions?)[:]?$/i },
    { key: "faqs", rx: /^(faqs?|frequently\s+asked\s+questions)[:]?$/i },
];

// Broad heading shapes that mean "back to the story" (Uses, Why…, About…)
const STORY_HEADING_RX = /^(uses?|why\b.{0,60}|about\b.{0,60}|what\b.{0,60}|the\s.{0,60})[?:]?$/i;

const MARKER_RX = /^\s*(?:[•·▪‣∙*-]|\d{1,3}[.)])\s*/;
const AMOUNT_RX = /\b\d+(?:\.\d+)?\s?(?:mg|mcg|µg|g|iu|ml|billion\s?cfu|%)\b/i;

export function guessBenefitIcon(title) {
    const t = String(title).toLowerCase();
    if (/(bone|joint|calcium|density|skelet)/.test(t)) return "bones";
    if (/(heart|cardio|cholesterol)/.test(t)) return "heart";
    if (/(immun|defen)/.test(t)) return "immunity";
    if (/(energy|stamina|fatigue|vitalit)/.test(t)) return "energy";
    if (/(muscle|strength|recovery|perform)/.test(t)) return "muscle";
    if (/(absor|bioavail)/.test(t)) return "absorption";
    if (/(digest|gut|metabol)/.test(t)) return "digestion";
    if (/(skin|glow|hair|nail|beauty)/.test(t)) return "skin";
    if (/sleep/.test(t)) return "sleep";
    if (/(stress|calm|anxiet|relax|mood)/.test(t)) return "calm";
    if (/(brain|focus|cognit|memory|clarity)/.test(t)) return "focus";
    if (/(eye|vision)/.test(t)) return "vision";
    return "general";
}

function parseIngredientLines(lines) {
    const rows = [];
    const leftovers = [];
    for (const raw of lines) {
        const line = raw.replace(MARKER_RX, "").trim();
        if (!line) continue;
        const isNameLine = line.length <= 60 && !/[.]$/.test(line);
        if (isNameLine) {
            const amountMatch = line.match(AMOUNT_RX);
            rows.push({
                name: amountMatch ? line.replace(AMOUNT_RX, "").replace(/\s{2,}/g, " ").replace(/[\s–—-]+$/, "").trim() || line : line,
                amount: amountMatch ? amountMatch[0] : "",
                purpose: "",
            });
        } else if (rows.length > 0) {
            const last = rows[rows.length - 1];
            last.purpose = last.purpose ? `${last.purpose} ${line}` : line;
        } else {
            leftovers.push(raw);
        }
    }
    return { rows: rows.filter((r) => r.name), leftovers };
}

function parseBenefitLines(lines) {
    const rows = [];
    for (const raw of lines) {
        const line = raw.replace(MARKER_RX, "").trim();
        if (!line) continue;
        const colon = line.indexOf(":");
        if (colon > 0 && colon <= 60) {
            const title = line.slice(0, colon).trim();
            rows.push({ icon: guessBenefitIcon(title), title, text: line.slice(colon + 1).trim() });
        } else if (line.length <= 60) {
            rows.push({ icon: guessBenefitIcon(line), title: line, text: "" });
        } else if (rows.length > 0 && !rows[rows.length - 1].text) {
            rows[rows.length - 1].text = line;
        } else {
            rows.push({ icon: "general", title: "", text: line });
        }
    }
    return rows.filter((r) => r.title || r.text);
}

function parseFaqLines(lines) {
    const faqs = [];
    for (const raw of lines) {
        const line = raw.replace(/^\s*(?:Q|A)[.:)]\s*/i, "").replace(MARKER_RX, "").trim();
        if (!line) continue;
        const isQuestion = /\?$/.test(line) || /^\s*Q[.:)]/i.test(raw);
        if (isQuestion || faqs.length === 0) {
            faqs.push({ q: line, a: "" });
        } else {
            const last = faqs[faqs.length - 1];
            last.a = last.a ? `${last.a} ${line}` : line;
        }
    }
    return faqs.filter((f) => f.q && f.a);
}

/**
 * Splits a pasted monograph into structured sections.
 * Returns { details, about, found } — `about` is the text left after the
 * recognised sections have been lifted out; `found` lists what was detected
 * so the caller can show a meaningful confirmation.
 */
export function organiseAboutText(text) {
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
    const buckets = { about: [], ingredients: [], benefits: [], howToUse: [], safety: [], faqs: [] };
    let bucket = "about";

    for (const raw of lines) {
        const line = raw.trim();
        const section = line.length <= 60 ? SECTION_MAP.find((s) => s.rx.test(line)) : null;
        if (section) { bucket = section.key; continue; }
        if (bucket !== "about" && line.length <= 64 && STORY_HEADING_RX.test(line)) {
            bucket = "about";
            buckets.about.push(raw);
            continue;
        }
        buckets[bucket].push(raw);
    }

    const { rows: ingredients, leftovers } = parseIngredientLines(buckets.ingredients);
    const details = {
        benefits: parseBenefitLines(buckets.benefits),
        ingredients,
        howToUse: buckets.howToUse.map((l) => l.replace(MARKER_RX, "").trim()).filter(Boolean),
        faqs: parseFaqLines(buckets.faqs),
        safetyInfo: buckets.safety.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    };

    const about = [...buckets.about, ...leftovers].join("\n").replace(/\n{3,}/g, "\n\n").trim();

    const found = [];
    if (details.benefits.length) found.push(`${details.benefits.length} benefits`);
    if (details.ingredients.length) found.push(`${details.ingredients.length} ingredients`);
    if (details.howToUse.length) found.push(`${details.howToUse.length} usage steps`);
    if (details.faqs.length) found.push(`${details.faqs.length} FAQs`);
    if (details.safetyInfo) found.push("safety info");

    return { details, about, found };
}

/* ── Shared editor chrome ───────────────────────────────────────────────── */

const inputCls =
    "w-full rounded-lg border border-[#E8E4DE] bg-white px-2.5 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-1 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] outline-none";

function SectionShell({ title, hint, count, onAdd, addLabel, children }) {
    return (
        <div className="rounded-xl border border-[#E8E4DE] bg-white p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-stone-600">
                    {title}
                    {count > 0 && <span className="ml-1.5 rounded-full bg-[#1e3a5f]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#1e3a5f]">{count}</span>}
                </div>
                {onAdd && (
                    <button
                        type="button"
                        onClick={onAdd}
                        className="rounded-lg border border-dashed border-stone-300 px-2.5 py-1 text-[11px] font-semibold text-stone-500 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition"
                    >
                        + {addLabel}
                    </button>
                )}
            </div>
            {hint && <div className="mt-0.5 text-[10px] text-stone-400">{hint}</div>}
            <div className="mt-2.5 space-y-2">{children}</div>
        </div>
    );
}

function RemoveButton({ onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title="Remove"
            className="h-7 w-7 shrink-0 rounded-lg border border-[#E8E4DE] text-xs text-stone-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition self-start"
        >
            ✕
        </button>
    );
}

/* ── The editor ─────────────────────────────────────────────────────────── */

/**
 * @param {{ value: object, onChange: (next: object) => void }} props
 * `value` is the normalized details object; every change calls onChange with
 * a fresh copy (parent owns the state).
 */
export default function ProductDetailsEditor({ value, onChange }) {
    const d = value;
    const patch = (key, next) => onChange({ ...d, [key]: next });
    const patchRow = (key, i, field, val) =>
        patch(key, d[key].map((row, j) => (j === i ? { ...row, [field]: val } : row)));
    const removeRow = (key, i) => patch(key, d[key].filter((_, j) => j !== i));

    return (
        <div className="space-y-3">
            {/* Key benefits */}
            <SectionShell
                title="Key benefits"
                hint='Shown as icon cards under "What it does for you". Aim for 3–6.'
                count={d.benefits.length}
                onAdd={() => patch("benefits", [...d.benefits, { icon: "general", title: "", text: "" }])}
                addLabel="Add benefit"
            >
                {d.benefits.length === 0 && <div className="text-[11px] text-stone-400">No benefits yet.</div>}
                {d.benefits.map((b, i) => (
                    <div key={i} className="flex flex-col gap-2 rounded-lg border border-[#E8E4DE] bg-stone-50 p-2.5 sm:flex-row sm:items-start">
                        <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f]/[0.07] text-[#1e3a5f]">
                                <BenefitIcon name={b.icon} className="h-4 w-4" />
                            </span>
                            <select
                                value={b.icon}
                                onChange={(e) => patchRow("benefits", i, "icon", e.target.value)}
                                className="rounded-lg border border-[#E8E4DE] bg-white px-2 py-1.5 text-xs text-stone-700 outline-none sm:w-36"
                            >
                                {ICON_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-start">
                            <input
                                value={b.title}
                                onChange={(e) => patchRow("benefits", i, "title", e.target.value)}
                                placeholder="Benefit title, e.g. Stronger bones"
                                className={`${inputCls} sm:w-52`}
                            />
                            <input
                                value={b.text}
                                onChange={(e) => patchRow("benefits", i, "text", e.target.value)}
                                placeholder="One short supporting line (optional)"
                                className={inputCls}
                            />
                        </div>
                        <RemoveButton onClick={() => removeRow("benefits", i)} />
                    </div>
                ))}
            </SectionShell>

            {/* Key ingredients */}
            <SectionShell
                title="Key ingredients"
                hint='Rendered as the "What&#39;s inside" table on the product page.'
                count={d.ingredients.length}
                onAdd={() => patch("ingredients", [...d.ingredients, { name: "", amount: "", purpose: "" }])}
                addLabel="Add ingredient"
            >
                {d.ingredients.length === 0 && <div className="text-[11px] text-stone-400">No ingredients yet.</div>}
                {d.ingredients.map((r, i) => (
                    <div key={i} className="flex flex-col gap-2 rounded-lg border border-[#E8E4DE] bg-stone-50 p-2.5 sm:flex-row sm:items-start">
                        <div className="grid flex-1 gap-2 sm:grid-cols-[200px_110px_1fr]">
                            <input
                                value={r.name}
                                onChange={(e) => patchRow("ingredients", i, "name", e.target.value)}
                                placeholder="Ingredient, e.g. Vitamin D3"
                                className={inputCls}
                            />
                            <input
                                value={r.amount}
                                onChange={(e) => patchRow("ingredients", i, "amount", e.target.value)}
                                placeholder="600 IU"
                                className={inputCls}
                            />
                            <input
                                value={r.purpose}
                                onChange={(e) => patchRow("ingredients", i, "purpose", e.target.value)}
                                placeholder="What it does, e.g. Improves calcium absorption"
                                className={inputCls}
                            />
                        </div>
                        <RemoveButton onClick={() => removeRow("ingredients", i)} />
                    </div>
                ))}
            </SectionShell>

            {/* How to use */}
            <SectionShell
                title="How to use"
                hint="One step per line — shown as numbered steps."
                count={d.howToUse.length}
            >
                <textarea
                    value={d.howToUse.join("\n")}
                    onChange={(e) => patch("howToUse", e.target.value.split("\n"))}
                    onBlur={(e) => patch("howToUse", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
                    rows={3}
                    placeholder={"Take one tablet daily after a meal.\nBest taken with water, at the same time each day."}
                    className="w-full rounded-lg border border-[#E8E4DE] bg-white px-2.5 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-1 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] outline-none"
                />
            </SectionShell>

            {/* FAQs */}
            <SectionShell
                title="FAQs"
                hint="Answer the questions customers actually ask — timing, food, who it's for."
                count={d.faqs.length}
                onAdd={() => patch("faqs", [...d.faqs, { q: "", a: "" }])}
                addLabel="Add FAQ"
            >
                {d.faqs.length === 0 && <div className="text-[11px] text-stone-400">No FAQs yet.</div>}
                {d.faqs.map((f, i) => (
                    <div key={i} className="flex gap-2 rounded-lg border border-[#E8E4DE] bg-stone-50 p-2.5">
                        <div className="flex flex-1 flex-col gap-2">
                            <input
                                value={f.q}
                                onChange={(e) => patchRow("faqs", i, "q", e.target.value)}
                                placeholder="Question, e.g. When should I take it?"
                                className={inputCls}
                            />
                            <textarea
                                value={f.a}
                                onChange={(e) => patchRow("faqs", i, "a", e.target.value)}
                                rows={2}
                                placeholder="Answer"
                                className="w-full rounded-lg border border-[#E8E4DE] bg-white px-2.5 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-1 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] outline-none"
                            />
                        </div>
                        <RemoveButton onClick={() => removeRow("faqs", i)} />
                    </div>
                ))}
            </SectionShell>

            {/* Safety info */}
            <SectionShell title="Safety information" hint="Cautions and storage. Start lines with • for bullets." count={d.safetyInfo ? 1 : 0}>
                <textarea
                    value={d.safetyInfo}
                    onChange={(e) => patch("safetyInfo", e.target.value)}
                    rows={3}
                    placeholder={"• Consult a healthcare professional if pregnant, nursing or on medication.\n• Keep out of reach of children.\n• Store in a cool, dry place."}
                    className="w-full rounded-lg border border-[#E8E4DE] bg-white px-2.5 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-1 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] outline-none"
                />
            </SectionShell>
        </div>
    );
}

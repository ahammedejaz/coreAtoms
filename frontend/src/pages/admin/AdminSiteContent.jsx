/**
 * AdminSiteContent.jsx — Every page's copy, editable from one place.
 *
 * The left rail lists the pages and shared surfaces declared in
 * `content/siteContent.js`; the form on the right is generated from that
 * page's field list, so adding an editable sentence to the storefront means
 * adding one field to the schema, never a new admin screen. Values save to
 * `app_settings` under the page's key; the storefront reads them through
 * `useSiteContent`. "Reset to defaults" writes the shipped copy back.
 *
 * Ctrl+S saves the open page. Saving is refused until the stored value has
 * loaded, so a failed read can never publish defaults over live copy.
 *
 * @module pages/admin/AdminSiteContent
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase/client";
import { useToast } from "../../context/ToastContext";
import useKeyboardShortcut from "../../hooks/useKeyboardShortcut";
import { PAGES, pageDef } from "../../content/siteContent";
import { fetchStoredContent, mergeContent, primeSiteContent } from "../../services/siteContent";
import { primeMotionSettings } from "../../context/MotionContext";

/** Every photograph on the storefront and the screen that edits it. */
const PHOTO_GUIDE = [
  { what: "Logo (header, footer, sign-in panel)", where: "Homepage → 1. Site logo", to: "/admin/homepage" },
  { what: "Hero photographs (home)", where: "Homepage → 2. Hero carousel", to: "/admin/homepage" },
  { what: "Category bottles (home category stage)", where: "Homepage → 6. Shop by category", to: "/admin/homepage" },
  { what: "Photo breaks (home, two full-width photographs)", where: "Site content → Home → Photo breaks", key: "page_home" },
  { what: "Sign-in panel photograph", where: "Site content → Account pages → Panel photograph", key: "page_account" },
  { what: "Product photographs", where: "Products → each product", to: "/admin/products" },
];

/** Where each page can be seen on the storefront. */
const PREVIEW = {
  site_global: "/", site_motion: "/", page_home: "/", page_shop: "/shop", page_product: "/shop", page_cart: "/cart",
  page_checkout: "/cart", page_account: "/login", page_orders: "/orders", page_faq: "/faq", page_contact: "/contact",
  page_legal_terms: "/terms", page_legal_privacy: "/privacy", page_legal_shipping: "/shipping-policy",
  page_legal_refund: "/refund-policy", page_errors: "/this-page-does-not-exist",
};

const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
function setPath(obj, path, value) {
  const keys = path.split(".");
  const out = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  let cur = out;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) { cur[k] = value; return; }
    const next = cur[k];
    cur[k] = Array.isArray(next) ? [...next] : { ...(next || {}) };
    cur = cur[k];
  });
  return out;
}

const inputCls = "w-full rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none focus:ring-2 focus:ring-[#1e3a5f]/20";
const smallBtn = "rounded-lg border border-[#E8E4DE] bg-white px-2 py-1 text-xs text-stone-600 hover:border-stone-400 hover:text-stone-900 disabled:opacity-30";
const removeBtn = "h-7 w-7 rounded-lg border border-red-200 bg-red-50 text-red-400 hover:bg-red-100 text-xs";
const addBtn = "w-full rounded-xl border-2 border-dashed border-stone-300 py-2 text-xs font-medium text-stone-400 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition";

function Label({ text, hint }) {
  return (
    <div className="mb-1.5">
      <div className="text-xs font-semibold text-stone-700">{text}</div>
      {hint && <div className="mt-0.5 text-[11px] text-stone-400">{hint}</div>}
    </div>
  );
}

/** Blank value for a list item of the given sub-fields. */
function blankFor(fields) {
  const out = {};
  fields.forEach((fl) => { out[fl.name] = fl.type === "list" || fl.type === "stringlist" ? [] : fl.type === "toggle" ? false : ""; });
  return out;
}

function ImageField({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const upload = async (file) => {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const ext = file.name.split(".").pop();
      const path = `content/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("hero-images").upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("hero-images").getPublicUrl(path);
      onChange(data?.publicUrl || "");
    } catch (e) {
      setErr(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-3">
      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-[#E8E4DE] bg-stone-50">
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[10px] text-stone-400">No image</div>}
      </div>
      <label className="cursor-pointer rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2 text-xs font-medium text-stone-700 hover:border-[#1e3a5f]/40 hover:bg-[#EFF6FF]">
        {busy ? "Uploading…" : "Choose image"}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {value && <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => onChange("")}>Remove</button>}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}

/** Renders one field of any type; lists recurse. */
function Field({ field, value, onChange }) {
  const { type, label, hint } = field;

  if (type === "toggle") {
    return (
      <label className="flex items-start gap-3 rounded-xl border border-[#E8E4DE] bg-stone-50 px-3 py-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(value)}
          onClick={() => onChange(!value)}
          className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${value ? "bg-[#1e3a5f]" : "bg-stone-300"}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] ${value ? "left-[18px]" : "left-0.5"}`} />
        </button>
        <span className="text-sm text-stone-800">{label}{hint && <span className="block text-[11px] text-stone-400">{hint}</span>}</span>
      </label>
    );
  }

  if (type === "select") {
    return (
      <div>
        <Label text={label} hint={hint} />
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (type === "number") {
    return (
      <div>
        <Label text={label} hint={hint} />
        <input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} className={inputCls} />
      </div>
    );
  }

  if (type === "image") {
    return (
      <div>
        <Label text={label} hint={hint} />
        <ImageField value={value} onChange={onChange} />
      </div>
    );
  }

  if (type === "textarea" || type === "richtext") {
    return (
      <div>
        <Label text={label} hint={hint || (type === "richtext" ? "Blank line for a new paragraph, “-” for bullets, **bold**, [label](/path) for a link." : undefined)} />
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={type === "richtext" ? 7 : 3} className={`${inputCls} resize-y leading-relaxed`} />
      </div>
    );
  }

  if (type === "stringlist") {
    const list = Array.isArray(value) ? value : [];
    const max = field.max || Infinity;
    return (
      <div>
        <Label text={label} hint={hint} />
        <div className="space-y-2">
          {list.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={item} onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} className={inputCls} />
              <button type="button" className={smallBtn} disabled={i === 0} onClick={() => { const a = [...list]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a); }} aria-label="Move up">↑</button>
              <button type="button" className={smallBtn} disabled={i === list.length - 1} onClick={() => { const a = [...list]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; onChange(a); }} aria-label="Move down">↓</button>
              <button type="button" className={removeBtn} onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
            </div>
          ))}
          {list.length < max && <button type="button" className={addBtn} onClick={() => onChange([...list, ""])}>+ Add line</button>}
        </div>
      </div>
    );
  }

  if (type === "list") {
    const list = Array.isArray(value) ? value : [];
    const max = field.max || Infinity;
    return (
      <div>
        <Label text={label} hint={hint} />
        <div className="space-y-3">
          {list.map((item, i) => (
            <div key={i} className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-stone-500">#{i + 1}</span>
                <div className="flex items-center gap-1.5">
                  <button type="button" className={smallBtn} disabled={i === 0} onClick={() => { const a = [...list]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a); }} aria-label="Move up">↑</button>
                  <button type="button" className={smallBtn} disabled={i === list.length - 1} onClick={() => { const a = [...list]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; onChange(a); }} aria-label="Move down">↓</button>
                  <button type="button" className={removeBtn} onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
                </div>
              </div>
              <div className="space-y-3">
                {field.fields.map((sub) => (
                  <Field
                    key={sub.name}
                    field={sub}
                    value={item?.[sub.name]}
                    onChange={(v) => onChange(list.map((x, j) => (j === i ? { ...x, [sub.name]: v } : x)))}
                  />
                ))}
              </div>
            </div>
          ))}
          {list.length < max && <button type="button" className={addBtn} onClick={() => onChange([...list, blankFor(field.fields)])}>+ Add</button>}
        </div>
      </div>
    );
  }

  if (type === "order") {
    const rows = field.rows || [];
    const current = Array.isArray(value) ? value : [];
    // Every declared row appears once; new rows join at the end, visible.
    const list = [
      ...current.filter((r) => rows.some((d) => d.key === r.key)),
      ...rows.filter((d) => !current.some((r) => r.key === d.key)).map((d) => ({ key: d.key, visible: true })),
    ];
    const labelOf = (k) => rows.find((d) => d.key === k)?.label || k;
    return (
      <div>
        <Label text={label} hint={hint || "Untick a section to hide it. Use the arrows to change the order."} />
        <ol className="divide-y divide-[#E8E4DE] rounded-xl border border-[#E8E4DE] bg-stone-50">
          {list.map((row, i) => (
            <li key={row.key} className="flex items-center gap-3 px-3 py-2">
              <input type="checkbox" checked={row.visible !== false} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, visible: e.target.checked } : x)))} className="h-4 w-4 accent-[#1e3a5f]" />
              <span className={`flex-1 text-sm ${row.visible === false ? "text-stone-400 line-through" : "text-stone-800"}`}>{labelOf(row.key)}</span>
              <button type="button" className={smallBtn} disabled={i === 0} onClick={() => { const a = [...list]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a); }} aria-label="Move up">↑</button>
              <button type="button" className={smallBtn} disabled={i === list.length - 1} onClick={() => { const a = [...list]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; onChange(a); }} aria-label="Move down">↓</button>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div>
      <Label text={label} hint={hint} />
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </div>
  );
}

export default function AdminSiteContent({ isActive = true }) {
  const { showToast } = useToast();
  const [activeKey, setActiveKey] = useState(PAGES[0].key);
  const page = useMemo(() => pageDef(activeKey), [activeKey]);
  const [value, setValue] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async (key) => {
    setLoaded(false); setLoadErr(""); setDirty(false);
    try {
      const stored = await fetchStoredContent(key);
      setValue(mergeContent(pageDef(key).defaults, stored));
      setLoaded(true);
    } catch (e) {
      setLoadErr(e?.message || "Could not load this page's content");
    }
  }, []);

  useEffect(() => { load(activeKey); }, [activeKey, load]);

  const update = (path, v) => { setValue((cur) => setPath(cur, path, v)); setDirty(true); };

  const save = useCallback(async () => {
    if (!loaded || !value) { showToast("Content is still loading", "info"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("app_settings").upsert({ key: activeKey, value }, { onConflict: "key" });
      if (error) throw error;
      primeSiteContent(activeKey, value);
      if (activeKey === "site_motion") primeMotionSettings(value);
      setDirty(false);
      showToast(`${page.title} saved. Changes are live.`, "success");
    } catch (e) {
      showToast(e?.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }, [activeKey, loaded, page, showToast, value]);

  const saveRef = useRef(save);
  saveRef.current = save;
  useKeyboardShortcut("ctrl+s", useCallback((e) => { if (!isActive) return; e.preventDefault(); saveRef.current(); }, [isActive]));

  const reset = () => { setValue(page.defaults); setDirty(true); };

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* Page list */}
      <nav aria-label="Pages" className="lg:sticky lg:top-4 lg:self-start">
        <select value={activeKey} onChange={(e) => setActiveKey(e.target.value)} className={`${inputCls} lg:hidden`}>
          {PAGES.map((p) => <option key={p.key} value={p.key}>{p.title}</option>)}
        </select>
        <ul className="hidden overflow-hidden rounded-2xl border border-[#E8E4DE] bg-white lg:block">
          {PAGES.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => setActiveKey(p.key)}
                className={`block w-full border-b border-[#E8E4DE] px-4 py-2.5 text-left text-sm transition-colors last:border-b-0 ${p.key === activeKey ? "bg-[#1e3a5f] font-semibold text-white" : "text-stone-700 hover:bg-stone-50"}`}
              >
                {p.title}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-2xl border border-[#E8E4DE] bg-white p-4">
          <div className="text-xs font-semibold text-stone-700">Where the photographs live</div>
          <ul className="mt-2 space-y-2">
            {PHOTO_GUIDE.map((g) => (
              <li key={g.what} className="text-[11.5px] leading-snug text-stone-500">
                <span className="text-stone-700">{g.what}</span>
                <br />
                {g.key ? (
                  <button type="button" onClick={() => setActiveKey(g.key)} className="font-medium text-[#1e3a5f] hover:underline">{g.where}</button>
                ) : (
                  <Link to={g.to} className="font-medium text-[#1e3a5f] hover:underline">{g.where}</Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Editor */}
      <div className="min-w-0 space-y-5">
        <div className="sticky top-0 z-20 flex flex-col gap-3 rounded-2xl border border-[#E8E4DE] bg-white/90 px-4 py-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-stone-900">{page.title}</div>
            <div className="text-xs text-stone-400">{page.description}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link to={PREVIEW[activeKey] || "/"} target="_blank" rel="noopener" className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50">View page</Link>
            <button type="button" onClick={reset} disabled={!loaded} className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40">Reset to defaults</button>
            <button type="button" onClick={save} disabled={!loaded || saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
              {saving ? "Saving…" : dirty ? "Save changes" : "Save"}
            </button>
          </div>
        </div>

        {loadErr && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Could not load this page's content, so saving is disabled. {loadErr}{" "}
            <button type="button" onClick={() => load(activeKey)} className="font-semibold underline">Try again</button>
          </div>
        )}

        {!loaded && !loadErr && <div className="py-10 text-center text-sm text-stone-400 animate-pulse">Loading…</div>}

        {loaded && value && (
          <div className="space-y-4 rounded-2xl border border-[#E8E4DE] bg-white p-6">
            {page.fields.map((field) => (
              <Field key={field.name} field={field} value={getPath(value, field.name)} onChange={(v) => update(field.name, v)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

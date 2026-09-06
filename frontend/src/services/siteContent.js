/**
 * siteContent.js — Reads and caches the editable copy for every page.
 *
 * All `site_*` and `page_*` keys are fetched together the first time any
 * page asks, merged over the defaults in `content/siteContent.js`, and kept
 * for the life of the page load. The admin's Site content editor calls
 * `primeSiteContent()` after a save so open storefront tabs in the same
 * session pick the change up without a reload.
 *
 * Merge rules: objects merge recursively, scalars from the database win,
 * arrays from the database replace the default wholesale (so an admin can
 * shorten a list), and anything the database does not mention keeps its
 * default. A failed read leaves the defaults in place and never throws.
 *
 * @module services/siteContent
 */
import { useEffect, useState } from "react";
import { supabase } from "./supabase/client";
import { DEFAULTS, PAGE_KEYS } from "../content/siteContent";

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

/** Deep merge of `stored` over `base` following the rules above. */
export function mergeContent(base, stored) {
  if (!isObj(stored)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(stored)) {
    if (isObj(v) && isObj(base?.[k])) out[k] = mergeContent(base[k], v);
    else if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

const stored = new Map();
const listeners = new Set();
let loaded = false;
let inflight = null;

function resolved(key) {
  return mergeContent(DEFAULTS[key] || {}, stored.get(key));
}

async function loadAll() {
  if (loaded) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await supabase.from("app_settings").select("key,value").in("key", PAGE_KEYS);
      if (!error) (data || []).forEach((row) => stored.set(row.key, row.value));
    } catch {
      /* defaults stand */
    } finally {
      loaded = true;
      inflight = null;
      listeners.forEach((fn) => fn());
    }
  })();
  return inflight;
}

/** Resolves to the merged content for one key. */
export async function fetchSiteContent(key) {
  await loadAll();
  return resolved(key);
}

/** Pushes a freshly saved value into the cache and notifies subscribers. */
export function primeSiteContent(key, value) {
  stored.set(key, value);
  listeners.forEach((fn) => fn());
}

/** The raw stored value (no defaults), for the editor. */
export async function fetchStoredContent(key) {
  await loadAll();
  return stored.get(key) ?? null;
}

/**
 * Merged content for one page. Returns the defaults immediately, then the
 * merged value once the settings have loaded, and updates after admin saves.
 */
export function useSiteContent(key) {
  const [value, setValue] = useState(() => resolved(key));
  useEffect(() => {
    let on = true;
    const update = () => { if (on) setValue(resolved(key)); };
    listeners.add(update);
    loadAll().then(update);
    return () => { on = false; listeners.delete(update); };
  }, [key]);
  return value;
}

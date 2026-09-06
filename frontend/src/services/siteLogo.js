/**
 * siteLogo.js — The logo the admin uploaded under Homepage → Site logo
 * (`app_settings.site_logo`), read once per page load and shared by the
 * header, the footer and the account panel. Resolves to "" when none is
 * set, so callers fall back to the bundled `/logo.png`.
 *
 * @module services/siteLogo
 */
import { useEffect, useState } from "react";
import { supabase } from "./supabase/client";

let cache = null;
let inflight = null;

export async function fetchSiteLogo() {
  if (cache !== null) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "site_logo").maybeSingle();
      const v = data?.value;
      cache = typeof v === "string" && v.startsWith("http") ? v : "";
    } catch {
      cache = "";
    } finally {
      inflight = null;
    }
    return cache;
  })();
  return inflight;
}

/** The logo URL to render: the uploaded one once known, else the bundled mark. */
export function useSiteLogo() {
  const [url, setUrl] = useState(cache || "");
  useEffect(() => {
    let on = true;
    fetchSiteLogo().then((v) => { if (on && v) setUrl(v); });
    return () => { on = false; };
  }, []);
  return url || "/logo.png";
}

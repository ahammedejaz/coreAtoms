/**
 * storeInfo.js — Business identity used by the footer, policy pages and
 * contact page.
 *
 * Reads the `store_info` key from `app_settings` (admin-editable under
 * Admin → Settings → Store information). Every field is optional: pages that
 * consume this must render sensibly with any subset missing, because the row
 * may not exist yet on a fresh project.
 *
 * The result is cached for the life of the page load — the footer alone would
 * otherwise re-query it on every route change.
 *
 * @module services/storeInfo
 */
import { supabase } from "./supabase/client";

/** Normalized empty shape — consumers can destructure without guards. */
export const EMPTY_STORE_INFO = Object.freeze({
    legalName: "",
    address: "",
    supportEmail: "",
    supportPhone: "",
    fssaiLicense: "",
    grievanceOfficer: "",
});

let cache = null;
let inflight = null;

function normalize(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const str = (v) => (typeof v === "string" ? v.trim() : "");
    return {
        legalName: str(src.legal_name),
        address: str(src.address),
        supportEmail: str(src.support_email),
        supportPhone: str(src.support_phone),
        fssaiLicense: str(src.fssai_license),
        grievanceOfficer: str(src.grievance_officer),
    };
}

/**
 * Fetches store info, caching the first successful (or empty) result.
 * Never throws — a read failure returns the empty shape so the footer and
 * policy pages always render.
 */
export async function fetchStoreInfo() {
    if (cache) return cache;
    if (inflight) return inflight;

    inflight = (async () => {
        try {
            const { data, error } = await supabase
                .from("app_settings")
                .select("value")
                .eq("key", "store_info")
                .maybeSingle();
            const info = error ? EMPTY_STORE_INFO : normalize(data?.value);
            cache = info;
            return info;
        } catch {
            return EMPTY_STORE_INFO;
        } finally {
            inflight = null;
        }
    })();

    return inflight;
}

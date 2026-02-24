/**
 * client.js — Supabase singleton client.
 *
 * Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the
 * environment (set in `.env.local`). Throws immediately if either is
 * missing so developers get a clear error instead of silent failures.
 *
 * @module services/supabase/client
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        "Missing Supabase environment variables. " +
        "Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local"
    );
}

/** @type {import('@supabase/supabase-js').SupabaseClient} */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * client.js — Supabase singleton client for React Native.
 *
 * Uses AsyncStorage for session persistence (instead of localStorage).
 * Reads EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from env.
 */
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env'
  );
}

const FETCH_TIMEOUT_MS = 30000;

/** Fetch wrapper with 30s timeout to prevent hanging on slow networks */
const fetchWithTimeout = (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // no URL-based auth in React Native
  },
  global: {
    fetch: fetchWithTimeout,
  },
  realtime: {
    params: { eventsPerSecond: 2 },
    // Use the native fetch (not the timeout wrapper) for realtime
    // so the long-lived WebSocket connection isn't killed after 30s
    fetch: globalThis.fetch,
  },
});

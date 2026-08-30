/**
 * AuthContext.jsx — Authentication state provider.
 *
 * Manages Supabase auth sessions, fetches user profiles with retry logic,
 * and exposes authentication info + `signOut` via the `useAuth()` hook.
 *
 * ### Exposed via `useAuth()`:
 * | Property          | Type       | Description |
 * |-------------------|------------|-------------|
 * | `loading`         | `boolean`  | `true` while the initial session is being resolved |
 * | `session`         | `object?`  | Raw Supabase session (or `null`) |
 * | `user`            | `object?`  | Supabase user object (or `null`) |
 * | `profile`         | `object?`  | Row from `profiles` table (id, email, full_name, role) |
 * | `isAuthenticated` | `boolean`  | `true` if a user session exists |
 * | `isAdmin`         | `boolean`  | `true` if `profile.role === "admin"` |
 * | `signOut`         | `Function` | Signs the user out and clears profile |
 *
 * @module context/AuthContext
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../services/supabase/client";
import { useToast } from "./ToastContext";

/** Auto sign-out after 1 hour (3 600 000 ms) of inactivity. */
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;
const ACTIVITY_STORAGE_KEY = "coreatoms_last_activity";
/** Throttle activity tracking to once per 30 seconds. */
const ACTIVITY_THROTTLE_MS = 30_000;

const AuthContext = createContext(null);

const PROFILE_CACHE_KEY = "coreatoms_profile";

function getCachedProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function AuthProvider({ children }) {
  const { showToast } = useToast();
  const cachedRef = useRef(getCachedProfile());
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  /** Prevents multiple session-expiry toasts from firing */
  const expiredToastShown = useRef(false);
  const [profile, setProfile] = useState(cachedRef.current);

  const user = session?.user ?? null;
  const isAuthenticated = !!user;
  const isAdmin = profile?.role === "admin";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Update profile + persist to cache (role is intentionally excluded from cache)
  const updateProfile = useCallback((data) => {
    setProfile(data);
    if (data) {
      try {
        // Never cache the role — always read it from the live DB to prevent stale admin access
        const { role: _omit, ...safeData } = data;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(safeData));
      } catch { /* cache write is best-effort */ }
    } else {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    }
  }, []);

  const fetchProfileWithRetry = useCallback(async (uid, attempts = 3) => {
    if (!uid) { updateProfile(null); return; }

    for (let i = 0; i < attempts; i++) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,full_name,role")
        .eq("id", uid)
        .maybeSingle();

      if (!error && data) { updateProfile(data); return; }

      console.warn(`Profile fetch ${i + 1}/${attempts}:`, error?.message || "no row");
      await sleep(200 * (i + 1));
    }

    updateProfile(null);
  }, [updateProfile]);

  useEffect(() => {
    let mounted = true;
    let initialDone = false; // prevents INITIAL_SESSION from racing with getSession

    // getSession() reads from local storage, NOT network — near-instant
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      initialDone = true;
      const s = data.session ?? null;
      setSession(s);

      if (s?.user?.id) {
        const cached = cachedRef.current;
        if (cached && cached.id === s.user.id) {
          // Cache hit — render immediately, verify in background
          setLoading(false);
          fetchProfileWithRetry(s.user.id);
        } else {
          // No cache or different user — must wait for profile
          await fetchProfileWithRetry(s.user.id);
          if (mounted) setLoading(false);
        }
      } else {
        // No session
        updateProfile(null);
        if (mounted) setLoading(false);
      }
    });

    // Listen for subsequent auth changes (login, logout, token refresh)
    // Skip INITIAL_SESSION since getSession handles it above
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!initialDone) return; // skip INITIAL_SESSION race
      setSession(newSession ?? null);
      if (newSession?.user?.id) {
        fetchProfileWithRetry(newSession.user.id);
      } else {
        updateProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription?.unsubscribe?.();
    };
  }, [fetchProfileWithRetry, updateProfile]);

  // ─── Inactivity session timeout ────────────────────────────────────
  const timerRef = useRef(null);
  const throttleRef = useRef(false);

  const handleSignOut = useCallback(async ({ expired = false } = {}) => {
    if (expired && !expiredToastShown.current) {
      expiredToastShown.current = true;
      showToast("Your session has expired due to inactivity. Please sign in again.", "warning", 6000);
    }
    await supabase.auth.signOut();
    updateProfile(null);
    localStorage.removeItem(ACTIVITY_STORAGE_KEY);
  }, [showToast, updateProfile]);

  useEffect(() => {
    if (!user) {
      // Not logged in → clear any lingering timer/timestamp
      clearTimeout(timerRef.current);
      return;
    }

    // Check if session already expired from a previous visit
    const lastActivity = Number(localStorage.getItem(ACTIVITY_STORAGE_KEY) || 0);
    if (lastActivity && Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS) {
      handleSignOut({ expired: true });
      return;
    }

    /** Resets the inactivity countdown and persists the timestamp. */
    const resetTimer = () => {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, Date.now().toString());
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => handleSignOut({ expired: true }), INACTIVITY_TIMEOUT_MS);
    };

    /** Throttled wrapper so we don't reset the timer on every pixel of mouse movement. */
    const onActivity = () => {
      if (throttleRef.current) return;
      throttleRef.current = true;
      resetTimer();
      setTimeout(() => { throttleRef.current = false; }, ACTIVITY_THROTTLE_MS);
    };

    // Kick off the first timer
    resetTimer();

    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    return () => {
      clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [user, handleSignOut]);

  const value = useMemo(
    () => ({
      loading,
      session,
      user,
      profile,
      isAuthenticated,
      isAdmin,
      signOut: handleSignOut,
    }),
    [loading, session, user, profile, isAuthenticated, isAdmin, handleSignOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};

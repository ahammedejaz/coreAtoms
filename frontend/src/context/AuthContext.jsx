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
 * | `roleResolved`    | `boolean`  | `true` once the live `role` has been read from the DB |
 * | `signOut`         | `Function` | Signs the user out and clears profile |
 *
 * `role` is never cached, so `isAdmin` is meaningless until `roleResolved` is
 * `true` — route guards must wait for it instead of guessing from `profile`.
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Reads the cached profile. `JSON.parse` happily returns arrays, numbers and
 * `null`, so anything that isn't a plain object with a real `id` is rejected.
 */
function getCachedProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (typeof parsed.id !== "string" || !parsed.id) return null;
    return parsed;
  } catch { return null; }
}

export function AuthProvider({ children }) {
  const { showToast } = useToast();
  const cachedRef = useRef(getCachedProfile());
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  /** Prevents multiple session-expiry toasts for the same sign-in */
  const expiredToastShown = useRef(false);
  const [profile, setProfile] = useState(cachedRef.current);
  /** `true` once the authoritative `role` has been read from (or ruled out by) the DB */
  const [roleResolved, setRoleResolved] = useState(false);
  /**
   * Bumped on every auth identity change. An in-flight profile fetch captures
   * the value and bails if it changed, so a slow retry loop can never
   * repopulate state (or the cache) for a user who has since signed out.
   */
  const generationRef = useRef(0);
  /** The user id the provider is currently tracking — drives identity-change checks. */
  const currentUserIdRef = useRef(null);
  const mountedRef = useRef(true);

  const user = session?.user ?? null;
  const userId = user?.id ?? null;
  const isAuthenticated = !!user;
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Update profile + persist to cache (role is intentionally excluded from cache)
  const updateProfile = useCallback((data) => {
    setProfile(data);
    try {
      if (data) {
        // Never cache the role — always read it from the live DB to prevent stale admin access
        const { role: _omit, ...safeData } = data;
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(safeData));
      } else {
        localStorage.removeItem(PROFILE_CACHE_KEY);
      }
    } catch { /* cache write is best-effort */ }
  }, []);

  /**
   * Fetches the `profiles` row, retrying because the row is trigger-created and
   * can lag a fresh sign-up. `generation` is the auth generation captured by the
   * caller: if the identity changes while a retry sleeps, the late result is
   * dropped instead of resurrecting a signed-out (or previous) user.
   */
  const fetchProfileWithRetry = useCallback(async (uid, generation, attempts = 3) => {
    const isStale = () => !mountedRef.current || generationRef.current !== generation;

    if (!uid) {
      if (!isStale()) { updateProfile(null); setRoleResolved(true); }
      return;
    }

    for (let i = 0; i < attempts; i++) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,full_name,role")
        .eq("id", uid)
        .maybeSingle();

      if (isStale()) return;

      if (!error && data) {
        updateProfile(data);
        setRoleResolved(true);
        return;
      }

      console.warn(`Profile fetch ${i + 1}/${attempts}:`, error?.message || "no row");
      await sleep(200 * (i + 1));
      if (isStale()) return;
    }

    // Give up — the role stays unknown-but-settled so guards fail closed
    // instead of hanging on a spinner forever.
    updateProfile(null);
    setRoleResolved(true);
  }, [updateProfile]);

  useEffect(() => {
    let cancelled = false;
    let initialDone = false; // prevents INITIAL_SESSION from racing with getSession

    const bootstrap = async () => {
      try {
        // getSession() reads from local storage, NOT network — near-instant
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        const s = data?.session ?? null;
        const generation = ++generationRef.current;
        currentUserIdRef.current = s?.user?.id ?? null;
        setSession(s);
        // Arm the listener as soon as the session is known — if a real auth event
        // lands while the profile fetch is still retrying, the generation guard
        // below makes the newer event win rather than dropping it.
        initialDone = true;

        if (s?.user?.id) {
          expiredToastShown.current = false;
          const cached = cachedRef.current;
          if (cached && cached.id === s.user.id) {
            // Cache hit — render immediately, verify (and resolve the role) in the background
            setLoading(false);
          }
          await fetchProfileWithRetry(s.user.id, generation);
        } else {
          // No session — there is no role to resolve
          updateProfile(null);
          setRoleResolved(true);
        }
      } catch (err) {
        // A rejected getSession() (or profile fetch) must never leave the app
        // stuck on "Loading…" with a listener that ignores every later event.
        console.error("Auth bootstrap failed:", err);
        if (!cancelled) setRoleResolved(true);
      } finally {
        initialDone = true;
        if (!cancelled) setLoading(false);
      }
    };

    bootstrap();

    // Listen for subsequent auth changes (login, logout, token refresh)
    // Skip INITIAL_SESSION since the bootstrap above handles it
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!initialDone || cancelled) return; // skip INITIAL_SESSION race
      if (event === "INITIAL_SESSION") return;

      const uid = newSession?.user?.id ?? null;
      const identityChanged = uid !== currentUserIdRef.current;
      currentUserIdRef.current = uid;
      setSession(newSession ?? null);

      // TOKEN_REFRESHED / USER_UPDATED keep the same identity (Supabase refreshes
      // roughly hourly) — the profile and its role are already loaded.
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
      if (!identityChanged) return;

      const generation = ++generationRef.current;
      if (uid) {
        expiredToastShown.current = false;
        setRoleResolved(false);
      }

      // Supabase holds its auth lock for the duration of this callback, so
      // calling back into the client from inside it can deadlock. Defer.
      setTimeout(() => {
        if (cancelled || generationRef.current !== generation) return;
        if (uid) {
          fetchProfileWithRetry(uid, generation);
        } else {
          updateProfile(null);
          setRoleResolved(true);
        }
      }, 0);
    });

    return () => {
      cancelled = true;
      sub.subscription?.unsubscribe?.();
    };
  }, [fetchProfileWithRetry, updateProfile]);

  // ─── Inactivity session timeout ────────────────────────────────────
  const timerRef = useRef(null);
  const throttleTimerRef = useRef(null);

  const handleSignOut = useCallback(async ({ expired = false } = {}) => {
    if (expired && !expiredToastShown.current) {
      expiredToastShown.current = true;
      showToast("Your session has expired due to inactivity. Please sign in again.", "warning", 6000);
    }
    await supabase.auth.signOut();
    updateProfile(null);
    try { localStorage.removeItem(ACTIVITY_STORAGE_KEY); } catch { /* best-effort */ }
  }, [showToast, updateProfile]);

  /**
   * Latest `handleSignOut` behind a stable ref. The countdown effect reads it
   * through the ref, so a new `showToast`/`updateProfile` identity can't restart
   * a fresh 60-minute timer with zero user activity.
   */
  const signOutRef = useRef(handleSignOut);
  useEffect(() => { signOutRef.current = handleSignOut; }, [handleSignOut]);

  // Keyed on `userId` (a stable primitive) — keying on the `user` object restarted
  // the countdown on every hourly TOKEN_REFRESHED, so it never actually fired.
  useEffect(() => {
    if (!userId) {
      // Not logged in → clear any lingering timers
      clearTimeout(timerRef.current);
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
      return;
    }

    // Check if session already expired from a previous visit
    let lastActivity = 0;
    try { lastActivity = Number(localStorage.getItem(ACTIVITY_STORAGE_KEY) || 0); } catch { /* best-effort */ }
    if (lastActivity && Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS) {
      signOutRef.current({ expired: true });
      return;
    }

    /** Resets the inactivity countdown and persists the timestamp. */
    const resetTimer = () => {
      try { localStorage.setItem(ACTIVITY_STORAGE_KEY, Date.now().toString()); } catch { /* best-effort */ }
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => signOutRef.current({ expired: true }), INACTIVITY_TIMEOUT_MS);
    };

    /** Throttled wrapper so we don't reset the timer on every pixel of mouse movement. */
    const onActivity = () => {
      if (throttleTimerRef.current !== null) return;
      resetTimer();
      throttleTimerRef.current = setTimeout(() => { throttleTimerRef.current = null; }, ACTIVITY_THROTTLE_MS);
    };

    // Kick off the first timer
    resetTimer();

    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [userId]);

  const value = useMemo(
    () => ({
      loading,
      session,
      user,
      profile,
      isAuthenticated,
      isAdmin,
      roleResolved,
      signOut: handleSignOut,
    }),
    [loading, session, user, profile, isAuthenticated, isAdmin, roleResolved, handleSignOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};

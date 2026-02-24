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

/** Auto sign-out after 1 hour (3 600 000 ms) of inactivity. */
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;
const ACTIVITY_STORAGE_KEY = "coreatoms_last_activity";
/** Throttle activity tracking to once per 30 seconds. */
const ACTIVITY_THROTTLE_MS = 30_000;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const user = session?.user ?? null;
  const isAuthenticated = !!user;
  const isAdmin = profile?.role === "admin";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const fetchProfileWithRetry = async (uid, attempts = 5) => {
    if (!uid) {
      setProfile(null);
      return;
    }

    for (let i = 0; i < attempts; i++) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,full_name,role")
        .eq("id", uid)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
        return;
      }

      const msg = error
        ? `${error.message} (code: ${error.code || "n/a"})`
        : "no row yet";

      console.warn(`Profile fetch attempt ${i + 1}/${attempts} failed:`, msg);

      await sleep(250 * (i + 1));
    }

    setProfile(null);
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const s = data.session ?? null;
      setSession(s);
      if (s?.user?.id) fetchProfileWithRetry(s.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
      if (newSession?.user?.id) fetchProfileWithRetry(newSession.user.id);
      else setProfile(null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription?.unsubscribe?.();
    };
  }, []);

  // ─── Inactivity session timeout ────────────────────────────────────
  const timerRef = useRef(null);
  const throttleRef = useRef(false);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    localStorage.removeItem(ACTIVITY_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (!user) {
      // Not logged in → clear any lingering timer/timestamp
      clearTimeout(timerRef.current);
      return;
    }

    // Check if session already expired from a previous visit
    const lastActivity = Number(localStorage.getItem(ACTIVITY_STORAGE_KEY) || 0);
    if (lastActivity && Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS) {
      handleSignOut();
      return;
    }

    /** Resets the inactivity countdown and persists the timestamp. */
    const resetTimer = () => {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, Date.now().toString());
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(handleSignOut, INACTIVITY_TIMEOUT_MS);
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

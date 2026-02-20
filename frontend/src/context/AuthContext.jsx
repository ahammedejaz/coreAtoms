import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase/client";

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

  const value = useMemo(
    () => ({
      loading,
      session,
      user,
      profile,
      isAuthenticated,
      isAdmin,
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
    }),
    [loading, session, user, profile, isAuthenticated, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};

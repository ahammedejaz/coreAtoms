/**
 * AuthContext.jsx — Authentication state provider for React Native.
 *
 * Mirrors web AuthContext but uses AsyncStorage instead of localStorage,
 * and AppState for inactivity tracking instead of DOM events.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase/client';
import { registerForPushNotifications, savePushToken, removePushToken } from '../services/notifications';
import { useToast } from './ToastContext';

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
const ACTIVITY_STORAGE_KEY = 'coreatoms_last_activity';
const PROFILE_CACHE_KEY = 'coreatoms_profile';

const AuthContext = createContext(null);

async function getCachedProfile() {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function AuthProvider({ children }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const expiredToastShown = useRef(false);

  const user = session?.user ?? null;
  const isAuthenticated = !!user;
  const isAdmin = profile?.role === 'admin';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const updateProfile = useCallback(async (data) => {
    setProfile(data);
    if (data) {
      try {
        const { role: _omit, ...safeData } = data;
        await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(safeData));
      } catch { }
    } else {
      await AsyncStorage.removeItem(PROFILE_CACHE_KEY).catch(() => {});
    }
  }, []);

  const fetchProfileWithRetry = useCallback(async (uid, attempts = 3) => {
    if (!uid) { updateProfile(null); return; }

    for (let i = 0; i < attempts; i++) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,full_name,role')
        .eq('id', uid)
        .maybeSingle();

      if (!error && data) { updateProfile(data); return; }
      await sleep(200 * (i + 1));
    }

    updateProfile(null);
  }, [updateProfile]);

  useEffect(() => {
    let mounted = true;
    let initialDone = false;

    // Load cached profile first, then check session to avoid race condition
    getCachedProfile().then(async (cached) => {
      if (mounted && cached) setProfile(cached);

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      initialDone = true;
      const s = data.session ?? null;
      setSession(s);

      if (s?.user?.id) {
        await fetchProfileWithRetry(s.user.id);
        if (mounted) setLoading(false);
      } else {
        updateProfile(null);
        if (mounted) setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!initialDone) return;
      setSession(newSession ?? null);
      if (newSession?.user?.id) {
        fetchProfileWithRetry(newSession.user.id);
        // Register push notifications (fire-and-forget)
        (async () => {
          try {
            const token = await registerForPushNotifications();
            if (token) await savePushToken(newSession.user.id, token);
          } catch (e) { console.warn('Push token registration failed:', e.message); }
        })();
      } else {
        updateProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription?.unsubscribe?.();
    };
  }, [fetchProfileWithRetry, updateProfile]);

  // ─── Inactivity session timeout (using AppState) ────────────────
  const handleSignOut = useCallback(async ({ expired = false } = {}) => {
    if (expired && !expiredToastShown.current) {
      expiredToastShown.current = true;
      showToast('Your session has expired due to inactivity. Please sign in again.', 'warning', 6000);
    }
    // Remove push tokens on sign-out
    if (user?.id) {
      try { await removePushToken(user.id); } catch { }
    }
    await supabase.auth.signOut();
    await updateProfile(null);
    await AsyncStorage.removeItem(ACTIVITY_STORAGE_KEY).catch(() => {});
  }, [showToast, updateProfile]);

  useEffect(() => {
    if (!user) return;

    // Record activity on app focus
    const recordActivity = async () => {
      await AsyncStorage.setItem(ACTIVITY_STORAGE_KEY, Date.now().toString()).catch(() => {});
    };

    // Check inactivity when app returns to foreground
    const checkInactivity = async () => {
      try {
        const lastActivity = await AsyncStorage.getItem(ACTIVITY_STORAGE_KEY);
        if (lastActivity && Date.now() - Number(lastActivity) > INACTIVITY_TIMEOUT_MS) {
          handleSignOut({ expired: true });
          return;
        }
      } catch { }
      recordActivity();
    };

    recordActivity();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkInactivity();
      } else if (state === 'background') {
        recordActivity();
      }
    });

    return () => subscription?.remove?.();
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
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

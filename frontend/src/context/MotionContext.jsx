/**
 * MotionContext.jsx — One place that decides how much motion this visit gets.
 *
 * The admin's `site_motion` setting (smooth scroll, custom cursor, route
 * curtain, grain, product stages, tilt, custom scrollbar) is combined with
 * what the device can actually do: a fine pointer for the cursor and tilt, a
 * desktop viewport for the stages, and the visitor's own reduced-motion
 * preference, which wins over everything. The admin dashboard never gets the
 * storefront effects. The custom cursor ships off; it is there for an admin
 * who wants it.
 *
 * @module context/MotionContext
 */
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../services/supabase/client";
import { usePrefersReducedMotion } from "../components/ScrollReveal";

export const DEFAULT_MOTION = Object.freeze({
  smoothScroll: true,
  scrollbar: true,
  cursor: false,
  curtain: true,
  grain: true,
  stage: true,
  tilt: true,
});

const MotionContext = createContext(null);

function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

let settingsCache = null;
let settingsInflight = null;
/** Reads `site_motion` once per page load; a failed read keeps the defaults. */
export async function fetchMotionSettings() {
  if (settingsCache) return settingsCache;
  if (settingsInflight) return settingsInflight;
  settingsInflight = (async () => {
    try {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "site_motion").maybeSingle();
      const v = data?.value && typeof data.value === "object" ? data.value : {};
      settingsCache = { ...DEFAULT_MOTION, ...v };
    } catch {
      settingsCache = { ...DEFAULT_MOTION };
    } finally {
      settingsInflight = null;
    }
    return settingsCache;
  })();
  return settingsInflight;
}

/** Lets the admin editor push a fresh value without a reload. */
export function primeMotionSettings(value) {
  settingsCache = { ...DEFAULT_MOTION, ...(value || {}) };
}

export function MotionProvider({ children }) {
  const { pathname } = useLocation();
  const reduceMotion = usePrefersReducedMotion();
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [settings, setSettings] = useState(() => settingsCache || DEFAULT_MOTION);

  useEffect(() => {
    let on = true;
    fetchMotionSettings().then((s) => { if (on) setSettings(s); });
    return () => { on = false; };
  }, []);

  const isAdminRoute = pathname.startsWith("/admin");

  const value = useMemo(() => {
    const storefront = !isAdminRoute;
    return {
      settings,
      reduceMotion,
      finePointer,
      isDesktop,
      smoothScroll: storefront && settings.smoothScroll && finePointer && !reduceMotion,
      scrollbar: storefront && settings.scrollbar && finePointer && isDesktop,
      cursor: storefront && settings.cursor && finePointer && !reduceMotion,
      curtain: storefront && settings.curtain && !reduceMotion,
      grain: storefront && settings.grain,
      stage: storefront && settings.stage && isDesktop && !reduceMotion,
      tilt: storefront && settings.tilt && finePointer && !reduceMotion,
    };
  }, [settings, reduceMotion, finePointer, isDesktop, isAdminRoute]);

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

/** Motion flags for this visit. Safe outside the provider: everything off. */
export function useMotion() {
  return useContext(MotionContext) || {
    settings: DEFAULT_MOTION, reduceMotion: false, finePointer: false, isDesktop: false,
    smoothScroll: false, scrollbar: false, cursor: false, curtain: false, grain: false, stage: false, tilt: false,
  };
}

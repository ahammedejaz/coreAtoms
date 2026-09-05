/**
 * useRecentlyViewed.js — Remembers the last few products a visitor opened.
 *
 * Stored in localStorage under `coreatoms_recent` as an ordered list of
 * product ids (newest first, max 8). Purely client-side: nothing is sent to
 * the backend, and the list survives sign-in/out like the guest cart does.
 *
 * @module hooks/useRecentlyViewed
 */
import { useCallback, useSyncExternalStore } from "react";

const KEY = "coreatoms_recent";
const MAX = 8;
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

let snapshot = null;
function getSnapshot() {
  if (snapshot === null) snapshot = read();
  return snapshot;
}

function write(list) {
  snapshot = list;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  const onStorage = (e) => { if (e.key === KEY) { snapshot = null; fn(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(fn); window.removeEventListener("storage", onStorage); };
}

export default function useRecentlyViewed() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, () => []);
  const record = useCallback((id) => {
    if (!id) return;
    const next = [String(id), ...getSnapshot().filter((x) => x !== String(id))].slice(0, MAX);
    write(next);
  }, []);
  return { ids, record };
}

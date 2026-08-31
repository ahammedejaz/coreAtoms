/**
 * CartContext.jsx — Global shopping cart state manager.
 *
 * Provides cart CRUD operations, order-limit enforcement, and localStorage
 * persistence. Every component that touches the cart should consume this
 * context via the `useCart()` hook.
 *
 * @module context/CartContext
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../services/supabase/client";

const CartContext = createContext(null);

const CART_STORAGE_KEY = "coreatoms_cart";
const COUPON_STORAGE_KEY = "coreatoms_coupon";
/** Fallback cap used until `max_items_per_order` arrives from `app_settings`. */
const DEFAULT_MAX_ITEMS = 15;

/** Coerces any max-items input into a usable positive integer. */
function safeCap(max) {
  const n = Math.floor(Number(max));
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_ITEMS;
}

/**
 * Normalizes a raw cart item array into a consistent shape.
 * Filters out items with qty <= 0 and sanitizes numeric fields. Quantities are
 * floored and capped so a hand-edited localStorage entry (`2.5`, `1e9`) can't
 * slip past the limits `addItem` enforces.
 *
 * @param {Array} items - Raw cart items (may come from localStorage).
 * @param {number} [maxQty] - Per-item ceiling (the max-items-per-order setting).
 * @returns {Array<{id:string, name:string, image:string, category:string, unitPrice:number, qty:number}>}
 */
function normalizeCartItems(items, maxQty = DEFAULT_MAX_ITEMS) {
  const list = Array.isArray(items) ? items : [];
  const cap = safeCap(maxQty);
  return list
    .map((x) => {
      const flooredQty = Math.floor(Number(x.qty));
      const qty = Number.isFinite(flooredQty) ? Math.min(Math.max(0, flooredQty), cap) : 0;
      const unitPrice = Number(x.unitPrice ?? x.price ?? 0); // accept legacy "price"
      return {
        id: String(x.id),
        name: x.name ?? "Product",
        image: x.image ?? "",
        category: x.category ?? "",
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
        qty,
      };
    })
    .filter((x) => x.qty > 0);
}

/**
 * Trims a normalized cart so the *total* quantity never exceeds `max`.
 * Earlier items keep their quantity; the overflow comes off the tail.
 */
function clampToLimit(items, max) {
  const cap = safeCap(max);
  let remaining = cap;
  const out = [];
  for (const item of items) {
    if (remaining <= 0) break;
    const qty = Math.min(item.qty, remaining);
    out.push(qty === item.qty ? item : { ...item, qty });
    remaining -= qty;
  }
  return out;
}

/** Reads the persisted cart from localStorage (returns [] on any error). */
function readCart(maxQty) {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return normalizeCartItems(raw ? JSON.parse(raw) : [], maxQty);
  } catch {
    return [];
  }
}

/**
 * CartProvider — wraps the app and provides cart state + actions.
 *
 * ### Exposed via `useCart()`:
 * | Property        | Type       | Description |
 * |-----------------|------------|-------------|
 * | `items`         | `Array`    | Current cart items |
 * | `addItem`       | `Function` | Add a product (enforces max-items) |
 * | `updateQty`     | `Function` | Set quantity for an item by id |
 * | `removeItem`    | `Function` | Remove an item by id |
 * | `clear`         | `Function` | Empty the entire cart |
 * | `totalItems`    | `number`   | Sum of all qty values |
 * | `subtotal`      | `number`   | Sum of (unitPrice × qty) |
 * | `maxItems`      | `number`   | Max items allowed per order |
 * | `lastAction`    | `object?`  | Last add/limit event (for toast display) |
 * | `refreshMaxItems` | `Function` | Re-fetch max items setting from Supabase |
 */
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => readCart());
  const [maxItems, setMaxItems] = useState(DEFAULT_MAX_ITEMS);

  /**
   * Tracks the most recent cart action for toast notifications.
   * Shape: `{ type: "add", name: string, qty: number }` or
   *        `{ type: "limit", message: string }` or `null`.
   * A fresh object is produced every time, so repeated identical warnings
   * still register with consumers.
   */
  const [lastAction, setLastAction] = useState(null);

  /** Latest limit behind a ref, so the auth listener never has to resubscribe. */
  const maxItemsRef = useRef(maxItems);
  useEffect(() => { maxItemsRef.current = maxItems; }, [maxItems]);

  /**
   * Same-tick mirror of `items`. The mutators read it instead of closing over
   * `items`, which keeps their identity stable — `Shop`/`Home` memoise their
   * add-to-cart handler on `addItem` so `ProductCard`'s `React.memo` holds.
   */
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  /** Sets the cart and keeps the mirror in step within the same tick. */
  const commitItems = useCallback((next) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  // Persist cart. localStorage throws in Safari private mode and on quota
  // overflow — and this provider sits above the router's ErrorBoundary, so an
  // unguarded throw here is an unrecoverable white screen.
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch { /* persistence is best-effort */ }
  }, [items]);

  /**
   * Keep the cart in step with auth changes.
   * - `SIGNED_IN`: re-read localStorage and merge, so items added as a guest
   *   survive an OAuth redirect (which reloads the whole app).
   * - `SIGNED_OUT`: drop the cart and any applied coupon, so the next person on
   *   a shared device doesn't inherit them.
   */
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        const cap = maxItemsRef.current;
        const saved = readCart(cap);
        const currentNorm = normalizeCartItems(itemsRef.current, cap);

        // If nothing in memory, restore from localStorage (handles OAuth redirect re-mount)
        if (currentNorm.length === 0) { commitItems(clampToLimit(saved, cap)); return; }
        // If localStorage is empty, keep the current in-memory cart
        if (saved.length === 0) { commitItems(currentNorm); return; }

        // Both have items — merge by combining and deduplicating by id.
        // Items already in current take precedence (prefer in-memory quantities)
        const merged = [...currentNorm];
        for (const savedItem of saved) {
          const existsInCurrent = currentNorm.some((x) => x.id === savedItem.id);
          if (!existsInCurrent) {
            merged.push(savedItem);
          }
        }
        // A merge can push the total past max_items_per_order — a state addItem
        // would have refused — so clamp it back down.
        commitItems(clampToLimit(normalizeCartItems(merged, cap), cap));
      } else if (event === "SIGNED_OUT") {
        commitItems([]);
        try { sessionStorage.removeItem(COUPON_STORAGE_KEY); } catch { /* best-effort */ }
      }
    });
    return () => sub.subscription?.unsubscribe?.();
  }, [commitItems]);

  /**
   * Fetches the `max_items_per_order` setting from the `app_settings` table.
   * Accepts value shapes: `{ n: 15 }`, `15`, or `"15"`.
   * Falls back to 15 if the fetch fails or returns an invalid value.
   */
  const fetchMaxItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "max_items_per_order")
        .maybeSingle();

      if (error) return;

      const raw = data?.value;
      const n = typeof raw === "object" && raw !== null ? Number(raw.n) : Number(raw);

      if (Number.isFinite(n) && n > 0) setMaxItems(n);
    } catch {
      // ignore – fallback to 15
    }
  }, []);

  // Fetch maxItems from Supabase on mount
  useEffect(() => {
    fetchMaxItems();
  }, [fetchMaxItems]);

  const totalItems = useMemo(
    () => (items || []).reduce((sum, x) => sum + (Number(x.qty) || 0), 0),
    [items]
  );

  const subtotal = useMemo(
    () =>
      (items || []).reduce(
        (sum, x) => sum + (Number(x.unitPrice) || 0) * (Number(x.qty) || 0),
        0
      ),
    [items]
  );

  /**
   * Adds a product to the cart (or increments its qty if already present).
   * Enforces the max-items-per-order limit. Sets `lastAction` for toast display.
   *
   * @param {object} product - Product object (must have `id`; uses `price`, `price_inr`, or `unitPrice`).
   * @param {number} [qty=1] - Number of units to add.
   */
  const addItem = useCallback((product, qty = 1) => {
    if (!product?.id) return;

    const productId = String(product.id);
    const productName = product.name ?? "Product";
    const productPrice = Number(product.price ?? product.price_inr ?? product.unitPrice ?? 0);
    const safeQty = Math.max(1, Math.floor(Number(qty)) || 1);

    // The limit maths and the `lastAction` signal live outside the state update:
    // React requires updaters to be pure, and StrictMode double-invokes them in
    // dev, which double-fired the Navbar toast.
    const cap = safeCap(maxItemsRef.current);
    const currentNorm = normalizeCartItems(itemsRef.current, cap);
    const currentCount = currentNorm.reduce((s, x) => s + x.qty, 0);
    const remaining = Math.max(0, cap - currentCount);

    if (remaining <= 0) {
      setLastAction({ type: "limit", message: `Max ${cap} items per order` });
      return;
    }

    const allowedQty = Math.min(safeQty, remaining);
    setLastAction({ type: "add", name: productName, qty: allowedQty });

    const existing = currentNorm.find((x) => x.id === productId);

    if (existing) {
      commitItems(currentNorm.map((x) =>
        x.id === productId
          ? {
            ...x,
            // preserve price always (never become 0)
            unitPrice: x.unitPrice || productPrice || 0,
            qty: x.qty + allowedQty,
          }
          : x
      ));
      return;
    }

    commitItems([
      ...currentNorm,
      {
        id: productId,
        name: productName,
        image: product.image ?? product.image_url ?? "",
        category: product.category ?? "",
        unitPrice: productPrice || 0,
        qty: allowedQty,
      },
    ]);
  }, [commitItems]);

  const updateQty = useCallback((id, nextQty) => {
    const targetId = String(id);
    const cap = safeCap(maxItemsRef.current);
    const prevNorm = normalizeCartItems(itemsRef.current, cap);
    const flooredQty = Math.floor(Number(nextQty));
    const qty = Number.isFinite(flooredQty) ? Math.max(0, flooredQty) : 0;

    // compute count excluding this item
    const countWithout = prevNorm
      .filter((x) => x.id !== targetId)
      .reduce((s, x) => s + x.qty, 0);

    const allowed = Math.max(0, cap - countWithout);
    const finalQty = Math.min(qty, allowed);

    if (finalQty <= 0) {
      commitItems(prevNorm.filter((x) => x.id !== targetId));
      return;
    }

    commitItems(prevNorm.map((x) =>
      x.id === targetId
        ? {
          ...x,
          qty: finalQty,
          unitPrice: Number(x.unitPrice) || 0, // keep price stable
        }
        : x
    ));
  }, [commitItems]);

  const removeItem = useCallback((id) => {
    const targetId = String(id);
    const cap = safeCap(maxItemsRef.current);
    commitItems(normalizeCartItems(itemsRef.current, cap).filter((x) => x.id !== targetId));
  }, [commitItems]);

  const clear = useCallback(() => commitItems([]), [commitItems]);

  /** Re-fetches maxItems from Supabase. Called by admin settings after saving. */
  const refreshMaxItems = fetchMaxItems;

  const value = useMemo(
    () => ({
      items,
      addItem,
      updateQty,
      removeItem,
      clear,
      totalItems,
      subtotal,
      maxItems,
      lastAction,
      refreshMaxItems,
    }),
    [items, addItem, updateQty, removeItem, clear, totalItems, subtotal, maxItems, lastAction, refreshMaxItems]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * Hook to access the cart context. Must be used inside `<CartProvider>`.
 * @returns {{ items, addItem, updateQty, removeItem, clear, totalItems, subtotal, maxItems, lastAction, refreshMaxItems }}
 */
export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
};

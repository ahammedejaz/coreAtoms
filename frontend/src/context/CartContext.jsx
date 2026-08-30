/**
 * CartContext.jsx — Global shopping cart state manager.
 *
 * Provides cart CRUD operations, order-limit enforcement, and localStorage
 * persistence. Every component that touches the cart should consume this
 * context via the `useCart()` hook.
 *
 * @module context/CartContext
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase/client";

const CartContext = createContext(null);

/**
 * Normalizes a raw cart item array into a consistent shape.
 * Filters out items with qty <= 0 and sanitizes numeric fields.
 *
 * @param {Array} items - Raw cart items (may come from localStorage).
 * @returns {Array<{id:string, name:string, image:string, category:string, unitPrice:number, qty:number}>}
 */
function normalizeCartItems(items) {
  const list = Array.isArray(items) ? items : [];
  return list
    .map((x) => {
      const qty = Math.max(0, Number(x.qty) || 0);
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

/** Reads the persisted cart from localStorage (returns [] on any error). */
function readCart() {
  try {
    const raw = localStorage.getItem("coreatoms_cart");
    return normalizeCartItems(raw ? JSON.parse(raw) : []);
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
  const [maxItems, setMaxItems] = useState(15);

  /**
   * Tracks the most recent cart action for toast notifications.
   * Shape: `{ type: "add", name: string, qty: number }` or
   *        `{ type: "limit", message: string }` or `null`.
   */
  const [lastAction, setLastAction] = useState(null);

  // Persist cart
  useEffect(() => {
    localStorage.setItem("coreatoms_cart", JSON.stringify(items));
  }, [items]);

  /**
   * Preserve guest cart across auth state changes.
   * When the user signs in (especially via OAuth redirect which causes a
   * full page reload), re-read the cart from localStorage so that items
   * added before login are restored.
   */
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        const saved = readCart();
        setItems((current) => {
          const currentNorm = normalizeCartItems(current);
          // If nothing in memory, restore from localStorage (handles OAuth redirect re-mount)
          if (currentNorm.length === 0) return saved;
          // If localStorage is empty or same, keep current in-memory cart
          if (saved.length === 0) return currentNorm;
          // Both have items — merge by combining and deduplicating by id
          // Items already in current take precedence (prefer in-memory quantities)
          const merged = [...currentNorm];
          for (const savedItem of saved) {
            const existsInCurrent = currentNorm.some((x) => x.id === savedItem.id);
            if (!existsInCurrent) {
              merged.push(savedItem);
            }
          }
          return normalizeCartItems(merged);
        });
      }
    });
    return () => sub.subscription?.unsubscribe?.();
  }, []);

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
    const safeQty = Math.max(1, Number(qty) || 1);

    setItems((prev) => {
      const prevNorm = normalizeCartItems(prev);

      // enforce max items per order across cart
      const currentCount = prevNorm.reduce((s, x) => s + (Number(x.qty) || 0), 0);
      const remaining = Math.max(0, Number(maxItems || 0) - currentCount);
      if (remaining <= 0) {
        setLastAction({ type: "limit", message: `Max ${maxItems} items per order` });
        return prevNorm;
      }

      const allowedQty = Math.min(safeQty, remaining);
      setLastAction({ type: "add", name: productName, qty: allowedQty });

      const existing = prevNorm.find((x) => String(x.id) === productId);

      if (existing) {
        return prevNorm.map((x) =>
          String(x.id) === productId
            ? {
              ...x,
              // preserve price always (never become 0)
              unitPrice: Number(x.unitPrice) || productPrice || 0,
              qty: (Number(x.qty) || 0) + allowedQty,
            }
            : x
        );
      }

      return [
        ...prevNorm,
        {
          id: productId,
          name: productName,
          image: product.image ?? product.image_url ?? "",
          category: product.category ?? "",
          unitPrice: productPrice || 0,
          qty: allowedQty,
        },
      ];
    });
  }, [maxItems]);

  const updateQty = useCallback((id, nextQty) => {
    const targetId = String(id);
    setItems((prev) => {
      const prevNorm = normalizeCartItems(prev);
      const qty = Math.max(0, Number(nextQty || 0));

      // compute count excluding this item
      const countWithout = prevNorm
        .filter((x) => String(x.id) !== targetId)
        .reduce((s, x) => s + (Number(x.qty) || 0), 0);

      const allowed = Math.max(0, Number(maxItems || 0) - countWithout);
      const finalQty = Math.min(qty, allowed);

      if (finalQty <= 0) return prevNorm.filter((x) => String(x.id) !== targetId);

      return prevNorm.map((x) =>
        String(x.id) === targetId
          ? {
            ...x,
            qty: finalQty,
            unitPrice: Number(x.unitPrice) || 0, // keep price stable
          }
          : x
      );
    });
  }, [maxItems]);

  const removeItem = useCallback((id) => {
    const targetId = String(id);
    setItems((prev) => normalizeCartItems(prev).filter((x) => String(x.id) !== targetId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

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

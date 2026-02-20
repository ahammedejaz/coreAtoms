import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase/client";

const CartContext = createContext(null);

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

function readCart() {
  try {
    const raw = localStorage.getItem("coreatoms_cart");
    return normalizeCartItems(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => readCart());
  const [maxItems, setMaxItems] = useState(15);

  // Persist cart
  useEffect(() => {
    localStorage.setItem("coreatoms_cart", JSON.stringify(items));
  }, [items]);

  // Fetch maxItems from Supabase setting (already working for you)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "max_items_per_order")
          .maybeSingle();

        if (error) return;

        // accept either {n: 15} or 15 or "15"
        const raw = data?.value;
        const n = typeof raw === "object" && raw !== null ? Number(raw.n) : Number(raw);

        if (alive && Number.isFinite(n) && n > 0) setMaxItems(n);
      } catch {
        // ignore – fallback to 15
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

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

  const addItem = (product, qty = 1) => {
    if (!product?.id) return;

    const productId = String(product.id);
    const productPrice = Number(product.price ?? product.price_inr ?? product.unitPrice ?? 0);
    const safeQty = Math.max(1, Number(qty) || 1);

    setItems((prev) => {
      const prevNorm = normalizeCartItems(prev);

      // enforce max items per order across cart
      const currentCount = prevNorm.reduce((s, x) => s + (Number(x.qty) || 0), 0);
      const remaining = Math.max(0, Number(maxItems || 0) - currentCount);
      if (remaining <= 0) return prevNorm;

      const allowedQty = Math.min(safeQty, remaining);
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
          name: product.name ?? "Product",
          image: product.image ?? product.image_url ?? "",
          category: product.category ?? "",
          unitPrice: productPrice || 0,
          qty: allowedQty,
        },
      ];
    });
  };

  const updateQty = (id, nextQty) => {
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
  };

  const removeItem = (id) => {
    const targetId = String(id);
    setItems((prev) => normalizeCartItems(prev).filter((x) => String(x.id) !== targetId));
  };

  const clear = () => setItems([]);

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
    }),
    [items, totalItems, subtotal, maxItems]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
};

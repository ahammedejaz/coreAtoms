/**
 * CartContext.jsx — Global shopping cart state for React Native.
 *
 * Mirrors web CartContext but uses AsyncStorage instead of localStorage.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase/client';
import { hapticMedium, hapticLight } from '../utils/haptics';

const CartContext = createContext(null);
const CART_KEY = 'coreatoms_cart';

function normalizeCartItems(items) {
  const list = Array.isArray(items) ? items : [];
  return list
    .map((x) => {
      const qty = Math.max(0, Number(x.qty) || 0);
      const unitPrice = Number(x.unitPrice ?? x.price ?? 0);
      return {
        id: String(x.id),
        name: x.name ?? 'Product',
        image: x.image ?? '',
        category: x.category ?? '',
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
        qty,
      };
    })
    .filter((x) => x.qty > 0);
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [maxItems, setMaxItems] = useState(15);
  const [lastAction, setLastAction] = useState(null);
  const initialized = useRef(false);

  // Load cart from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(CART_KEY).then((raw) => {
      try {
        const parsed = raw ? JSON.parse(raw) : [];
        setItems(normalizeCartItems(parsed));
      } catch {
        setItems([]);
      }
      initialized.current = true;
    });
  }, []);

  // Persist cart to AsyncStorage on change
  useEffect(() => {
    if (initialized.current) {
      AsyncStorage.setItem(CART_KEY, JSON.stringify(items)).catch(() => {});
    }
  }, [items]);

  // Restore cart on sign-in (merge strategy matches web), clear on sign-out
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        AsyncStorage.getItem(CART_KEY).then((raw) => {
          try {
            const saved = normalizeCartItems(raw ? JSON.parse(raw) : []);
            setItems((current) => {
              const currentNorm = normalizeCartItems(current);
              // If nothing in memory, restore from storage (handles app restart after OAuth)
              if (currentNorm.length === 0) return saved;
              // If storage is empty, keep current in-memory cart
              if (saved.length === 0) return currentNorm;
              // Both have items — merge with dedup (in-memory takes precedence)
              const merged = [...currentNorm];
              for (const savedItem of saved) {
                if (!currentNorm.some((x) => x.id === savedItem.id)) {
                  merged.push(savedItem);
                }
              }
              return normalizeCartItems(merged);
            });
          } catch { }
        });
      } else if (event === 'SIGNED_OUT') {
        // Prevent data leakage: clear cart when user signs out
        setItems([]);
        AsyncStorage.removeItem(CART_KEY).catch(() => {});
      }
    });
    return () => sub.subscription?.unsubscribe?.();
  }, []);

  const fetchMaxItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'max_items_per_order')
        .maybeSingle();

      if (error) return;
      const raw = data?.value;
      const n = typeof raw === 'object' && raw !== null ? Number(raw.n) : Number(raw);
      if (Number.isFinite(n) && n > 0) setMaxItems(n);
    } catch { }
  }, []);

  useEffect(() => { fetchMaxItems(); }, [fetchMaxItems]);

  const totalItems = useMemo(
    () => (items || []).reduce((sum, x) => sum + (Number(x.qty) || 0), 0),
    [items]
  );

  const subtotal = useMemo(
    () => (items || []).reduce((sum, x) => sum + (Number(x.unitPrice) || 0) * (Number(x.qty) || 0), 0),
    [items]
  );

  const addItem = useCallback((product, qty = 1) => {
    if (!product?.id) return;

    const productId = String(product.id);
    const productName = product.name ?? 'Product';
    const productPrice = Number(product.price ?? product.price_inr ?? product.unitPrice ?? 0);
    const safeQty = Math.max(1, Number(qty) || 1);

    setItems((prev) => {
      const prevNorm = normalizeCartItems(prev);
      const currentCount = prevNorm.reduce((s, x) => s + (Number(x.qty) || 0), 0);
      const remaining = Math.max(0, Number(maxItems || 0) - currentCount);

      if (remaining <= 0) {
        // Schedule side effect outside of updater via microtask
        queueMicrotask(() => setLastAction({ type: 'limit', message: `Max ${maxItems} items per order` }));
        return prevNorm;
      }

      const allowedQty = Math.min(safeQty, remaining);
      // Schedule side effect outside of updater via microtask
      queueMicrotask(() => {
        setLastAction({ type: 'add', name: productName, qty: allowedQty });
        hapticMedium();
      });

      const existing = prevNorm.find((x) => String(x.id) === productId);

      if (existing) {
        return prevNorm.map((x) =>
          String(x.id) === productId
            ? { ...x, unitPrice: Number(x.unitPrice) || productPrice || 0, qty: (Number(x.qty) || 0) + allowedQty }
            : x
        );
      }

      return [
        ...prevNorm,
        {
          id: productId,
          name: productName,
          image: product.image ?? '',
          category: product.category ?? '',
          unitPrice: productPrice,
          sku: product.sku ?? '',
          qty: allowedQty,
          variantId: product.variantId || null,
          variantLabel: product.variantLabel || '',
        },
      ];
    });
  }, [maxItems]);

  const updateQty = useCallback((id, nextQty) => {
    const targetId = String(id);
    setItems((prev) => {
      const prevNorm = normalizeCartItems(prev);
      const qty = Math.max(0, Number(nextQty || 0));
      const countWithout = prevNorm
        .filter((x) => String(x.id) !== targetId)
        .reduce((s, x) => s + (Number(x.qty) || 0), 0);
      const allowed = Math.max(0, Number(maxItems || 0) - countWithout);
      const finalQty = Math.min(qty, allowed);

      if (finalQty <= 0) return prevNorm.filter((x) => String(x.id) !== targetId);

      return prevNorm.map((x) =>
        String(x.id) === targetId
          ? { ...x, qty: finalQty, unitPrice: Number(x.unitPrice) || 0 }
          : x
      );
    });
  }, [maxItems]);

  const removeItem = useCallback((id) => {
    const targetId = String(id);
    setItems((prev) => normalizeCartItems(prev).filter((x) => String(x.id) !== targetId));
    hapticLight();
  }, []);

  const clear = useCallback(async () => {
    setItems([]);
    try {
      await AsyncStorage.removeItem(CART_KEY);
    } catch { }
  }, []);

  const value = useMemo(
    () => ({
      items, addItem, updateQty, removeItem, clear,
      totalItems, subtotal, maxItems, lastAction,
      refreshMaxItems: fetchMaxItems,
    }),
    [items, addItem, updateQty, removeItem, clear, totalItems, subtotal, maxItems, lastAction, fetchMaxItems]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
};

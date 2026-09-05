/**
 * CartDrawerContext.jsx — Open/close state for the slide-over cart.
 *
 * Kept apart from CartContext so the cart's data layer stays free of UI
 * concerns and the mobile app's copy of the cart logic keeps its shape.
 * The drawer itself (`components/CartDrawer.jsx`) opens automatically on
 * every successful add via `CartContext.lastAction`.
 *
 * @module context/CartDrawerContext
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const CartDrawerContext = createContext(null);

export function CartDrawerProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);
  return <CartDrawerContext.Provider value={value}>{children}</CartDrawerContext.Provider>;
}

export function useCartDrawer() {
  const ctx = useContext(CartDrawerContext);
  if (!ctx) throw new Error("useCartDrawer must be used inside CartDrawerProvider");
  return ctx;
}

/**
 * Cart.jsx — Shopping cart page.
 *
 * Displays cart items with quantity steppers, line totals, order summary,
 * and a "Proceed to checkout" CTA. Redirects to `/login` if unauthenticated.
 *
 * @module pages/Cart
 */
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import SEO from "../components/SEO";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function Cart() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { items, totalItems, subtotal, updateQty, removeItem, clear } = useCart();

  return (
    <div>
      <SEO title="Cart | Core Atoms" description="Review your cart and proceed to checkout." />
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="section-label">Review & Checkout</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-stone-900">Your Cart</h1>
        </div>
        <Link to="/shop" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">← Continue shopping</Link>
      </div>

      {!items || items.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-stone-100 flex items-center justify-center">
            <svg className="h-7 w-7 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-stone-900">Your cart is empty</h2>
          <p className="mt-1 text-sm text-stone-500">Discover our range of premium supplements.</p>
          <Link to="/shop" className="btn-primary mt-6 inline-flex">Browse products</Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Items */}
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => {
              const lineTotal = (Number(item.unitPrice) || 0) * (Number(item.qty) || 0);
              return (
                <div key={item.id} className="card p-5">
                  <div className="flex gap-4">
                    <div className="h-20 w-20 shrink-0 rounded-xl border border-[#E8E4DE] bg-stone-50 overflow-hidden">
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-stone-900 text-[15px] leading-snug">{item.name}</h3>
                          {item.category && <p className="text-xs text-stone-400 mt-0.5">{item.category}</p>}
                          <p className="text-sm text-stone-500 mt-1">{money(item.unitPrice)} each</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-stone-400">Subtotal</p>
                          <p className="text-base font-semibold text-stone-900">{money(lineTotal)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        {/* Qty stepper */}
                        <div className="inline-flex items-center rounded-xl border border-[#E8E4DE] bg-stone-50">
                          <button type="button" onClick={() => updateQty(item.id, Math.max(0, item.qty - 1))}
                            className="h-8 w-8 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-l-xl transition">−</button>
                          <span className="w-10 text-center text-sm font-semibold text-stone-900">{item.qty}</span>
                          <button type="button" onClick={() => updateQty(item.id, item.qty + 1)}
                            className="h-8 w-8 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-r-xl transition">+</button>
                        </div>
                        <button type="button" onClick={() => removeItem(item.id)}
                          className="text-xs text-stone-400 hover:text-red-500 transition-colors">Remove</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <button type="button" onClick={clear} className="text-xs text-stone-400 hover:text-red-500 transition-colors pt-1">
              Clear entire cart
            </button>
          </div>

          {/* Summary */}
          <div>
            <div className="card p-6 sticky top-24">
              <h2 className="text-base font-semibold text-stone-900 mb-5">Order Summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal ({totalItems} item{totalItems !== 1 ? "s" : ""})</span>
                  <span className="font-semibold text-stone-900">{money(subtotal)}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Shipping</span>
                  <span className="font-semibold text-emerald-600">Free</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Payment</span>
                  <span className="font-semibold text-stone-900">Cash on Delivery</span>
                </div>
              </div>

              <div className="my-5 h-px bg-[#E8E4DE]" />

              <div className="flex justify-between mb-6">
                <span className="font-semibold text-stone-900">Total</span>
                <span className="text-xl font-semibold text-stone-900">{money(subtotal)}</span>
              </div>

              <button
                type="button"
                onClick={() => { if (!isAuthenticated) navigate("/login"); else navigate("/checkout"); }}
                className="btn-primary w-full py-3 text-[14px]"
              >
                Proceed to checkout
              </button>

              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {["🔒 Secure", "📦 Quality packing", "🇮🇳 India only"].map((t) => (
                  <span key={t} className="text-[11px] text-stone-400">{t}</span>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

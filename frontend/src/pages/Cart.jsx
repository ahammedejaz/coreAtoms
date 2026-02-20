import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

export default function Cart() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { items, totalItems, subtotal, updateQty, removeItem, clear } = useCart();

  const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  const handleCheckout = () => {
    if (!isAuthenticated) return navigate("/login");
    navigate("/checkout");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-950">Your Cart</h1>
          <p className="text-sm text-neutral-600">Adjust quantities and checkout.</p>
        </div>
        <Link to="/shop" className="text-sm text-neutral-700 hover:text-neutral-950 underline">
          Continue shopping
        </Link>
      </div>

      {!items || items.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
          <div className="text-lg font-medium text-neutral-900">Your cart is empty</div>
          <p className="mt-2 text-sm text-neutral-600">Add some products to get started.</p>
          <Link
            to="/shop"
            className="mt-6 inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-900 shadow-sm hover:shadow transition"
          >
            Go to Shop
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const lineTotal = (Number(item.unitPrice) || 0) * (Number(item.qty) || 0);

              return (
                <div key={item.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="flex gap-4">
                    <div className="h-24 w-24 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-neutral-950">{item.name}</div>
                          {item.category && (
                            <div className="mt-1 text-xs text-neutral-500">{item.category}</div>
                          )}
                          <div className="mt-1 text-sm text-neutral-700">
                            Unit: <span className="font-semibold text-neutral-900">{money(item.unitPrice)}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm text-neutral-600">Subtotal</div>
                          <div className="text-base font-semibold text-neutral-950">{money(lineTotal)}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-2 py-1">
                          <button
                            className="h-8 w-8 rounded-lg hover:bg-neutral-100 transition"
                            onClick={() => updateQty(item.id, Math.max(0, (item.qty || 1) - 1))}
                            type="button"
                          >
                            −
                          </button>
                          <div className="w-10 text-center text-sm font-semibold text-neutral-900">
                            {item.qty}
                          </div>
                          <button
                            className="h-8 w-8 rounded-lg hover:bg-neutral-100 transition"
                            onClick={() => updateQty(item.id, (item.qty || 1) + 1)}
                            type="button"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-sm text-neutral-700 hover:text-neutral-950 underline"
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm h-fit">
            <div className="text-lg font-semibold text-neutral-950">Summary</div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between text-neutral-700">
                <span>Total items</span>
                <span className="font-semibold text-neutral-950">{totalItems}</span>
              </div>
              <div className="flex items-center justify-between text-neutral-700">
                <span>Shipping</span>
                <span className="font-semibold text-neutral-950">Free</span>
              </div>
              <div className="h-px bg-neutral-200 my-3" />
              <div className="flex items-center justify-between">
                <span className="text-neutral-700">Total</span>
                <span className="text-base font-semibold text-neutral-950">{money(subtotal)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-neutral-200 to-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-950 shadow-sm hover:shadow hover:scale-[1.01] transition"
              type="button"
            >
              Proceed to Checkout
            </button>

            <button
              onClick={clear}
              className="mt-3 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-800 hover:bg-neutral-50 transition"
              type="button"
            >
              Clear cart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

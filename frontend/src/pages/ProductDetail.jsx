import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { fetchProductById } from "../services/products";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function ProductDetail() {
  const { id } = useParams(); // uuid
  const navigate = useNavigate();
  const { items, addItem, maxItems, updateQty } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const p = await fetchProductById(id);
        if (alive) setProduct(p);
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load product");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const cartItem = useMemo(() => (items || []).find((x) => String(x.id) === String(id)), [items, id]);
  const cartQty = cartItem?.qty || 0;

  const cartCount = useMemo(
    () => (items || []).reduce((s, x) => s + (Number(x.qty) || 0), 0),
    [items]
  );

  const remainingInOrder = Math.max(0, Number(maxItems || 0) - cartCount);

  const stockQty = Number(product?.stockQty || 0);
  const remainingStock = Math.max(0, stockQty - cartQty);

  // can add only if order limit AND stock limit allow
  const canAdd = remainingInOrder > 0 && remainingStock > 0;

  const handlePlus = () => {
    if (!product) return;
    if (!canAdd) return;
    addItem(product, 1);
  };

  const handleMinus = () => {
    if (!cartItem) return;
    const next = Math.max(0, cartQty - 1);
    updateQty(cartItem.id, next);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="text-sm text-neutral-600">Loading…</div>
      </div>
    );
  }

  if (err || !product) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="text-lg font-semibold text-neutral-950">Product not found</div>
          <div className="mt-2 text-sm text-neutral-600">{err || "This product may be inactive."}</div>
          <Link to="/shop" className="mt-3 inline-block text-sm underline text-neutral-700 hover:text-neutral-950">
            Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/shop" className="text-sm text-neutral-700 hover:text-neutral-950 underline">
            Back to Shop
          </Link>
          <div className="text-xs text-neutral-500">
            Max per order: <span className="font-semibold text-neutral-900">{maxItems}</span> • In cart:{" "}
            <span className="font-semibold text-neutral-900">{cartCount}</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Image */}
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="h-[440px] sm:h-[360px] bg-neutral-50 overflow-hidden">
              <img
                src={product.image}
                alt={product.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="p-4 text-xs text-neutral-500 flex items-center gap-2">
              {stockQty > 0 ? (
                <>
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-emerald-700">In Stock</span>
                </>
              ) : (
                <>
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="font-semibold text-red-700">Out of stock</span>
                </>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="text-xs text-neutral-500">Core Atoms</div>
            <h1 className="mt-1 text-2xl font-semibold text-neutral-950">{product.name}</h1>

            <div className="mt-2 text-sm text-neutral-600">
              {product.description || "Clean formula. Daily consistency. Built for performance and recovery."}
            </div>

            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <div className="text-xs text-neutral-500">Price</div>
                <div className="text-2xl font-semibold text-neutral-950">{money(product.price)}</div>
                <div className="mt-1 text-xs text-neutral-500">Cash on Delivery (India only)</div>
              </div>

              <div className="text-right text-xs text-neutral-500">
                Remaining in order:{" "}
                <span className="font-semibold text-neutral-900">{remainingInOrder}</span>
              </div>
            </div>

            {/* Qty + Actions */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
                <button
                  type="button"
                  onClick={handleMinus}
                  disabled={cartQty <= 0}
                  className="h-9 w-9 rounded-lg hover:bg-neutral-100 transition disabled:opacity-40"
                  aria-label="Decrease quantity"
                >
                  −
                </button>

                <div className="w-12 text-center text-sm font-semibold text-neutral-900">
                  {cartQty}
                </div>

                <button
                  type="button"
                  onClick={handlePlus}
                  disabled={!canAdd}
                  className="h-9 w-9 rounded-lg hover:bg-neutral-100 transition disabled:opacity-40 disabled:hover:bg-transparent"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <button
                onClick={() => navigate("/cart")}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 hover:shadow transition"
                type="button"
              >
                Go to cart
              </button>

              <button
                onClick={() => navigate("/checkout")}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 hover:shadow transition"
                type="button"
              >
                Checkout
              </button>
            </div>

            {!canAdd && (
              <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                {remainingInOrder <= 0
                  ? `You reached the max items per order (${maxItems}). Please checkout or reduce cart quantity.`
                  : `This item is out of stock (or you've added all available stock).`}
              </div>
            )}

            {/* Specs inside same card */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Info label="Category" value={product.category || "General"} />
              <Info label="SKU" value={String(product.id).slice(0, 8).toUpperCase()} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom content */}
      <div className="mx-auto mt-6 max-w-6xl px-4 pb-10">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="text-base font-semibold text-neutral-950">About this product</div>
          <div className="mt-2 text-sm text-neutral-700 leading-relaxed">
            {product.aboutText ||
              "Built for daily consistency — clean support for your routine. Ideal for anyone looking for a simple, premium supplement experience."}
          </div>

          {(product.bestFor || product.pairsWellWith || product.recommendedStack) && (
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {product.bestFor && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="text-sm font-semibold text-neutral-950">Best for</div>
                  <div className="mt-1 text-sm text-neutral-700">{product.bestFor}</div>
                </div>
              )}
              {product.pairsWellWith && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="text-sm font-semibold text-neutral-950">Pairs well with</div>
                  <div className="mt-1 text-sm text-neutral-700">{product.pairsWellWith}</div>
                </div>
              )}
              {product.recommendedStack && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="text-sm font-semibold text-neutral-950">Recommended</div>
                  <div className="mt-1 text-sm text-neutral-700">{product.recommendedStack}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-sm font-semibold text-neutral-950">{value}</div>
    </div>
  );
}

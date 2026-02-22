import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { fetchProductById } from "../services/products";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { items, addItem, maxItems, updateQty } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        setActiveImg(0);
        const p = await fetchProductById(id);
        if (alive) setProduct(p);
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load product");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const cartItem = useMemo(() => (items || []).find((x) => String(x.id) === String(id)), [items, id]);
  const cartQty = cartItem?.qty || 0;
  const cartCount = useMemo(() => (items || []).reduce((s, x) => s + (Number(x.qty) || 0), 0), [items]);
  const remainingInOrder = Math.max(0, Number(maxItems || 0) - cartCount);
  const stockQty = Number(product?.stockQty || 0);
  const remainingStock = Math.max(0, stockQty - cartQty);
  const canAdd = remainingInOrder > 0 && remainingStock > 0;

  const handlePlus = () => { if (product && canAdd) addItem(product, 1); };
  const handleMinus = () => { if (cartItem) updateQty(cartItem.id, Math.max(0, cartQty - 1)); };

  // gallery helpers
  const images = product?.images?.length ? product.images : product?.image ? [product.image] : [];
  const clampedIdx = Math.min(activeImg, Math.max(0, images.length - 1));

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
          {/* ── Image Gallery ── */}
          <div className="flex flex-col gap-3">
            {/* Main image */}
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
              <div className="h-[440px] sm:h-[400px] bg-neutral-50 overflow-hidden relative">
                {images.length > 0 ? (
                  <img
                    key={clampedIdx}
                    src={images[clampedIdx]}
                    alt={`${product.name} — image ${clampedIdx + 1}`}
                    className="h-full w-full object-cover transition-opacity duration-200"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-neutral-400">No image</div>
                )}

                {/* Prev / Next arrows — only when multiple images */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/80 backdrop-blur-sm border border-neutral-200 shadow flex items-center justify-center text-neutral-700 hover:bg-white transition"
                      aria-label="Previous image"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveImg((i) => (i + 1) % images.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/80 backdrop-blur-sm border border-neutral-200 shadow flex items-center justify-center text-neutral-700 hover:bg-white transition"
                      aria-label="Next image"
                    >
                      ›
                    </button>

                    {/* Dot indicator */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActiveImg(i)}
                          className={[
                            "h-1.5 rounded-full transition-all",
                            i === clampedIdx ? "w-5 bg-neutral-900" : "w-1.5 bg-neutral-400",
                          ].join(" ")}
                          aria-label={`Image ${i + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="px-4 py-3 text-xs text-neutral-500 flex items-center gap-2">
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
                {images.length > 1 && (
                  <span className="ml-auto text-neutral-400">{clampedIdx + 1} / {images.length}</span>
                )}
              </div>
            </div>

            {/* Thumbnail strip — only when multiple images */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImg(i)}
                    className={[
                      "shrink-0 h-16 w-16 rounded-xl border-2 overflow-hidden transition",
                      i === clampedIdx
                        ? "border-neutral-900 shadow-sm"
                        : "border-neutral-200 hover:border-neutral-400",
                    ].join(" ")}
                    aria-label={`View image ${i + 1}`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Details ── */}
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
                <div className="w-12 text-center text-sm font-semibold text-neutral-900">{cartQty}</div>
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

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Info label="Category" value={product.category || "General"} />
              <Info label="SKU" value={String(product.id).slice(0, 8).toUpperCase()} />
            </div>
          </div>
        </div>
      </div>

      {/* About section */}
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

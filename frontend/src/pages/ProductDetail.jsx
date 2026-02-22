import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { fetchProductById } from "../services/products";
import { supabase } from "../services/supabase/client";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function Stars({ rating, interactive = false, onSelect }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type={interactive ? "button" : undefined}
          onClick={interactive ? () => onSelect(i) : undefined}
          className={[
            "text-xl leading-none transition",
            interactive ? "cursor-pointer hover:scale-110" : "cursor-default",
            i <= rating ? "text-amber-400" : "text-neutral-200",
          ].join(" ")}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ productId, onSubmitted }) {
  const { user } = useAuth();
  const [eligibleOrders, setEligibleOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [checkingEligibility, setCheckingEligibility] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setCheckingEligibility(true);
      // Find delivered orders containing this product that haven't been reviewed yet
      const { data: orders } = await supabase
        .from("orders")
        .select("id, created_at, order_items(product_id)")
        .eq("user_id", user.id)
        .eq("status", "delivered");

      const eligible = (orders || []).filter((o) =>
        (o.order_items || []).some((it) => it.product_id === productId)
      );

      // Filter out orders that already have a review
      const { data: existing } = await supabase
        .from("product_reviews")
        .select("order_id")
        .eq("product_id", productId)
        .eq("user_id", user.id);

      const reviewedOrderIds = new Set((existing || []).map((r) => r.order_id));
      const unreviewed = eligible.filter((o) => !reviewedOrderIds.has(o.id));

      setEligibleOrders(unreviewed);
      if (unreviewed.length > 0) setSelectedOrderId(unreviewed[0].id);
      setCheckingEligibility(false);
    })();
  }, [user?.id, productId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) { setError("Please select a star rating."); return; }
    if (!selectedOrderId) { setError("No eligible order found."); return; }
    setSubmitting(true);
    setError("");

    const { error: err } = await supabase.from("product_reviews").insert({
      product_id: productId,
      user_id: user.id,
      order_id: selectedOrderId,
      rating,
      title: title.trim() || null,
      body: body.trim() || null,
    });

    setSubmitting(false);
    if (err) { setError(err.message); return; }
    onSubmitted();
  };

  if (!user) return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
      <Link to="/login" className="font-semibold underline text-neutral-900">Sign in</Link> to leave a review after purchasing this product.
    </div>
  );

  if (checkingEligibility) return (
    <div className="text-sm text-neutral-400">Checking purchase history…</div>
  );

  if (eligibleOrders.length === 0) return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
      You can leave a review after your order of this product is delivered.
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
      <div className="text-sm font-semibold text-neutral-900">Write a Review</div>

      <div>
        <div className="text-xs text-neutral-500 mb-1.5">Your rating *</div>
        <Stars rating={rating} interactive onSelect={setRating} />
      </div>

      <div>
        <div className="text-xs text-neutral-500 mb-1">Review title</div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Summarise your experience…"
          maxLength={120}
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none"
        />
      </div>

      <div>
        <div className="text-xs text-neutral-500 mb-1">Review</div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Tell others about your experience with this product…"
          rows={4}
          maxLength={1000}
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-300 outline-none resize-none"
        />
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <button
        type="submit"
        disabled={submitting || !rating}
        className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 transition"
      >
        {submitting ? "Submitting…" : "Submit Review"}
      </button>
    </form>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { items, addItem, maxItems, updateQty } = useCart();
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [activeImg, setActiveImg] = useState(0);
  const [showReviewForm, setShowReviewForm] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      setActiveImg(0);
      const p = await fetchProductById(id);
      setProduct(p);
    } catch (e) {
      setErr(e?.message || "Failed to load product");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const cartItem = useMemo(() => (items || []).find((x) => String(x.id) === String(id)), [items, id]);
  const cartQty = cartItem?.qty || 0;
  const cartCount = useMemo(() => (items || []).reduce((s, x) => s + (Number(x.qty) || 0), 0), [items]);
  const remainingInOrder = Math.max(0, Number(maxItems || 0) - cartCount);
  const stockQty = Number(product?.stockQty || 0);
  const remainingStock = Math.max(0, stockQty - cartQty);
  const canAdd = remainingInOrder > 0 && remainingStock > 0;

  const handlePlus = () => { if (product && canAdd) addItem(product, 1); };
  const handleMinus = () => { if (cartItem) updateQty(cartItem.id, Math.max(0, cartQty - 1)); };

  const images = product?.images?.length ? product.images : product?.image ? [product.image] : [];
  const clampedIdx = Math.min(activeImg, Math.max(0, images.length - 1));
  const reviews = product?.reviews || [];
  const avgRating = product?.avgRating;
  const reviewCount = product?.reviewCount || 0;

  if (loading) return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="text-sm text-neutral-600">Loading…</div>
    </div>
  );

  if (err || !product) return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="text-lg font-semibold text-neutral-950">Product not found</div>
        <div className="mt-2 text-sm text-neutral-600">{err || "This product may be inactive."}</div>
        <Link to="/shop" className="mt-3 inline-block text-sm underline text-neutral-700">Back to Shop</Link>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/shop" className="text-sm text-neutral-700 hover:text-neutral-950 underline">Back to Shop</Link>
          <div className="text-xs text-neutral-500">
            Max per order: <span className="font-semibold text-neutral-900">{maxItems}</span> • In cart:{" "}
            <span className="font-semibold text-neutral-900">{cartCount}</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Gallery ── */}
          <div className="flex flex-col gap-3">
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

                {images.length > 1 && (
                  <>
                    <button type="button" onClick={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/80 backdrop-blur-sm border border-neutral-200 shadow flex items-center justify-center text-neutral-700 hover:bg-white transition">‹</button>
                    <button type="button" onClick={() => setActiveImg((i) => (i + 1) % images.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/80 backdrop-blur-sm border border-neutral-200 shadow flex items-center justify-center text-neutral-700 hover:bg-white transition">›</button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {images.map((_, i) => (
                        <button key={i} type="button" onClick={() => setActiveImg(i)}
                          className={["h-1.5 rounded-full transition-all", i === clampedIdx ? "w-5 bg-neutral-900" : "w-1.5 bg-neutral-400"].join(" ")} />
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="px-4 py-3 text-xs text-neutral-500 flex items-center gap-2">
                {stockQty > 0 ? (
                  <><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /><span className="font-semibold text-emerald-700">In Stock</span></>
                ) : (
                  <><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /><span className="font-semibold text-red-700">Out of stock</span></>
                )}
                {images.length > 1 && <span className="ml-auto text-neutral-400">{clampedIdx + 1} / {images.length}</span>}
              </div>
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((url, i) => (
                  <button key={i} type="button" onClick={() => setActiveImg(i)}
                    className={["shrink-0 h-16 w-16 rounded-xl border-2 overflow-hidden transition", i === clampedIdx ? "border-neutral-900 shadow-sm" : "border-neutral-200 hover:border-neutral-400"].join(" ")}>
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

            {/* Rating summary */}
            {reviewCount > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <Stars rating={Math.round(avgRating)} />
                <span className="text-sm font-semibold text-neutral-900">{avgRating}</span>
                <span className="text-sm text-neutral-500">({reviewCount} review{reviewCount !== 1 ? "s" : ""})</span>
              </div>
            )}

            <div className="mt-3 text-sm text-neutral-600">
              {product.description || "Clean formula. Daily consistency. Built for performance and recovery."}
            </div>

            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <div className="text-xs text-neutral-500">Price</div>
                <div className="text-2xl font-semibold text-neutral-950">{money(product.price)}</div>
                <div className="mt-1 text-xs text-neutral-500">Cash on Delivery (India only)</div>
              </div>
              <div className="text-right text-xs text-neutral-500">
                Remaining in order: <span className="font-semibold text-neutral-900">{remainingInOrder}</span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
                <button type="button" onClick={handleMinus} disabled={cartQty <= 0}
                  className="h-9 w-9 rounded-lg hover:bg-neutral-100 transition disabled:opacity-40">−</button>
                <div className="w-12 text-center text-sm font-semibold text-neutral-900">{cartQty}</div>
                <button type="button" onClick={handlePlus} disabled={!canAdd}
                  className="h-9 w-9 rounded-lg hover:bg-neutral-100 transition disabled:opacity-40">+</button>
              </div>
              <button onClick={() => navigate("/cart")} className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 transition" type="button">Go to cart</button>
              <button onClick={() => navigate("/checkout")} className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 transition" type="button">Checkout</button>
            </div>

            {!canAdd && (
              <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                {remainingInOrder <= 0
                  ? `You reached the max items per order (${maxItems}).`
                  : `This item is out of stock (or you've added all available stock).`}
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Info label="Category" value={product.category || "General"} />
              <Info label="SKU" value={product.sku ? product.sku.toUpperCase() : String(product.id).slice(0, 8).toUpperCase()} />
            </div>
          </div>
        </div>
      </div>

      {/* ── About ── */}
      <div className="mx-auto mt-6 max-w-6xl px-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="text-base font-semibold text-neutral-950">About this product</div>
          <div className="mt-2 text-sm text-neutral-700 leading-relaxed">
            {product.aboutText || "Built for daily consistency — clean support for your routine."}
          </div>
          {(product.bestFor || product.pairsWellWith || product.recommendedStack) && (
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {product.bestFor && <InfoCard label="Best for" value={product.bestFor} />}
              {product.pairsWellWith && <InfoCard label="Pairs well with" value={product.pairsWellWith} />}
              {product.recommendedStack && <InfoCard label="Recommended" value={product.recommendedStack} />}
            </div>
          )}
        </div>
      </div>

      {/* ── Reviews ── */}
      <div className="mx-auto mt-6 max-w-6xl px-4 pb-10">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">

          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-base font-semibold text-neutral-950">Customer Reviews</div>
              {reviewCount > 0 ? (
                <div className="mt-1 flex items-center gap-2">
                  <Stars rating={Math.round(avgRating)} />
                  <span className="text-sm font-semibold text-neutral-900">{avgRating} out of 5</span>
                  <span className="text-sm text-neutral-500">• {reviewCount} review{reviewCount !== 1 ? "s" : ""}</span>
                </div>
              ) : (
                <div className="mt-1 text-sm text-neutral-500">No reviews yet. Be the first!</div>
              )}
            </div>
            {user && (
              <button
                type="button"
                onClick={() => setShowReviewForm((v) => !v)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 shadow-sm transition"
              >
                {showReviewForm ? "Cancel" : "Write a Review"}
              </button>
            )}
          </div>

          {/* Review form */}
          {showReviewForm && (
            <div className="mt-5">
              <ReviewForm
                productId={id}
                onSubmitted={() => {
                  setShowReviewForm(false);
                  load();
                }}
              />
            </div>
          )}

          {/* Rating breakdown */}
          {reviewCount > 0 && (
            <div className="mt-6 grid gap-1.5 max-w-xs">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = reviews.filter((r) => r.rating === star).length;
                const pct = reviewCount ? Math.round((count / reviewCount) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs text-neutral-500">
                    <span className="w-4 text-right">{star}</span>
                    <span className="text-amber-400">★</span>
                    <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Review list */}
          {reviews.length > 0 && (
            <div className="mt-6 space-y-4 divide-y divide-neutral-100">
              {reviews.map((r) => (
                <div key={r.id} className="pt-4 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Stars rating={r.rating} />
                        {r.title && <span className="text-sm font-semibold text-neutral-900">{r.title}</span>}
                      </div>
                      <div className="mt-0.5 text-xs text-neutral-500">
                        {r.reviewerName} • {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                      </div>
                    </div>
                    <span className="shrink-0 inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Verified Purchase
                    </span>
                  </div>
                  {r.body && <p className="mt-2 text-sm text-neutral-700 leading-relaxed">{r.body}</p>}
                </div>
              ))}
            </div>
          )}

          {reviews.length === 0 && !showReviewForm && (
            <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
              No reviews yet for this product.
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

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="text-sm font-semibold text-neutral-950">{label}</div>
      <div className="mt-1 text-sm text-neutral-700">{value}</div>
    </div>
  );
}

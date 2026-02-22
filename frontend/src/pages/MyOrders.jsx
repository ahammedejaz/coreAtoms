import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../services/supabase/client";
import { useAuth } from "../context/AuthContext";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// ── Inline review form shown directly on delivered order items ──────────────
function InlineReviewForm({ productId, orderId, productName, onDone }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!rating) { setError("Please select a star rating."); return; }
    setSubmitting(true);
    setError("");
    const { error: err } = await supabase.from("product_reviews").insert({
      product_id: productId,
      user_id: user.id,
      order_id: orderId,
      rating,
      title: null,
      body: body.trim() || null,
    });
    setSubmitting(false);
    if (err) {
      if (err.message?.includes("unique") || err.code === "23505") {
        setError("You've already reviewed this product.");
      } else {
        setError(err.message);
      }
      return;
    }
    onDone();
  };

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="text-xs font-semibold text-amber-800">Rate your purchase — {productName}</div>

      {/* Star picker */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setRating(i)}
            className="text-2xl transition-transform hover:scale-110 leading-none"
          >
            <span className={i <= (hovered || rating) ? "text-amber-400" : "text-neutral-300"}>★</span>
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-xs text-amber-700 font-medium self-center">
            {["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
          </span>
        )}
      </div>

      {/* Optional description */}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share your experience (optional)…"
        rows={3}
        maxLength={1000}
        className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:ring-2 focus:ring-amber-300 outline-none resize-none"
      />

      {error && <div className="text-xs text-red-600">{error}</div>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !rating}
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition"
        >
          {submitting ? "Submitting…" : "Submit Review"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

export default function MyOrders() {
  const { user } = useAuth();
  const userId = user?.id;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Track which product+order combos have been reviewed this session
  const [reviewedKeys, setReviewedKeys] = useState(new Set());
  // Track which review forms are open { "productId_orderId": true }
  const [openReviews, setOpenReviews] = useState({});
  // Track existing reviews to not show form again
  const [existingReviews, setExistingReviews] = useState(new Set());

  const load = async () => {
    if (!userId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        status,
        created_at,
        total_amount_inr,
        total_items,
        order_items (
          id,
          product_id,
          product_name,
          qty,
          unit_price_inr,
          line_total_inr,
          image_url
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) { console.error(error); setOrders([]); }
    else setOrders(data || []);

    // Load existing reviews by this user to avoid showing form again
    const { data: reviewData } = await supabase
      .from("product_reviews")
      .select("product_id, order_id")
      .eq("user_id", userId);

    const keys = new Set(
      (reviewData || []).map((r) => `${r.product_id}_${r.order_id}`)
    );
    setExistingReviews(keys);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const onCancel = async (orderId, status) => {
    const s = (status || "").toLowerCase();
    if (s === "shipped" || s === "delivered") {
      alert("This order cannot be cancelled after shipment starts.");
      return;
    }
    if (!confirm("Cancel this order?")) return;
    const { error } = await supabase.rpc("cancel_order", {
      p_order_id: orderId,
      p_user_id: userId,
    });
    if (error) return alert(error.message);
    await load();
  };

  const toggleReview = (productId, orderId) => {
    const key = `${productId}_${orderId}`;
    setOpenReviews((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const onReviewDone = (productId, orderId) => {
    const key = `${productId}_${orderId}`;
    setOpenReviews((prev) => ({ ...prev, [key]: false }));
    setReviewedKeys((prev) => new Set([...prev, key]));
    setExistingReviews((prev) => new Set([...prev, key]));
  };

  const filteredOrders = (orders || []).filter((o) => {
    const s = String(o.status || "").toLowerCase();
    const okStatus = statusFilter === "all" ? true : s === statusFilter;
    const q = String(search || "").trim().toLowerCase();
    if (!q) return okStatus;
    const idText = String(o.id || "").toLowerCase();
    const createdText = o.created_at ? new Date(o.created_at).toLocaleString().toLowerCase() : "";
    const itemText = (o.order_items || [])
      .map((it) => `${it.product_name || ""} ${it.product_id || ""}`)
      .join(" ")
      .toLowerCase();
    return okStatus && (idText.includes(q) || createdText.includes(q) || itemText.includes(q));
  });

  const statusOptions = [
    { value: "all", label: "All" },
    { value: "placed", label: "Placed" },
    { value: "processing", label: "Processing" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const statusBadge = (status) => {
    const s = (status || "").toLowerCase();
    const map = {
      placed: "bg-green-100 text-green-700",
      processing: "bg-yellow-100 text-yellow-700",
      shipped: "bg-blue-100 text-blue-700",
      delivered: "bg-emerald-100 text-emerald-700",
      cancelled: "bg-red-100 text-red-700",
    };
    return `px-3 py-1 rounded-full text-xs font-semibold ${map[s] || "bg-neutral-100 text-neutral-700"}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-2xl font-semibold tracking-tight">My Orders</h2>
      <p className="mt-1 text-sm text-neutral-500">Track your order status here.</p>

      {/* Filters */}
      <div className="mt-5 card p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <div className="text-xs text-neutral-500">Status</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-200"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs text-neutral-500">Search</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order id, date, product name…"
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-200"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-neutral-500">
            Showing <span className="font-semibold text-neutral-900">{filteredOrders.length}</span> order(s)
          </div>
          {(statusFilter !== "all" || (search || "").trim()) && (
            <button onClick={() => { setStatusFilter("all"); setSearch(""); }} className="btn-ghost" type="button">
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="mt-6 card p-6">
          <div className="text-sm text-neutral-600">Loading your orders…</div>
        </div>
      )}

      {!loading && filteredOrders.length === 0 && (
        <div className="mt-6 card p-8 text-center">
          <div className="text-base font-semibold text-neutral-950">No orders found</div>
          <div className="mt-1 text-sm text-neutral-600">
            {statusFilter !== "all" || (search || "").trim()
              ? "Try clearing filters or searching something else."
              : "Place your first order and it will show up here."}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {filteredOrders.map((o) => {
          const items = o.order_items || [];
          const fallbackTotal = items.reduce((s, it) => s + Number(it.line_total_inr || 0), 0);
          const fallbackItems = items.reduce((s, it) => s + Number(it.qty || 0), 0);
          const totalAmount = Number(o.total_amount_inr ?? fallbackTotal ?? 0);
          const totalCount = Number(o.total_items ?? fallbackItems ?? 0);
          const status = o.status || "placed";
          const isDelivered = status.toLowerCase() === "delivered";
          const cancellable = ["placed", "processing"].includes(status.toLowerCase());

          return (
            <div key={o.id} className="card p-6">
              {/* Order header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-neutral-500">
                    Order <span className="font-semibold text-neutral-950">{String(o.id).slice(0, 8)}</span>
                  </div>
                  <div className="mt-1 text-sm text-neutral-700">
                    Total: <span className="font-semibold">{money(totalAmount)}</span> • Items:{" "}
                    <span className="font-semibold">{totalCount}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span className={statusBadge(status)}>{status}</span>
                  {isDelivered && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      ✓ Delivered
                    </span>
                  )}
                  {cancellable && (
                    <button onClick={() => onCancel(o.id, status)} className="btn-ghost" type="button">
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Order items */}
              <div className="mt-4 border-t border-neutral-200 pt-4 space-y-4">
                {items.map((it) => {
                  const reviewKey = `${it.product_id}_${o.id}`;
                  const alreadyReviewed = existingReviews.has(reviewKey) || reviewedKeys.has(reviewKey);
                  const reviewOpen = openReviews[reviewKey];

                  return (
                    <div key={it.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex items-center gap-3">
                          {it.image_url && (
                            <img
                              src={it.image_url}
                              alt={it.product_name || "Product"}
                              className="h-12 w-12 rounded-xl object-cover border border-neutral-200 shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-neutral-950">
                              {it.product_name || "Product"} × {it.qty}
                            </div>
                            <div className="text-xs text-neutral-500">{money(it.unit_price_inr)} each</div>

                            {/* Review CTA — only on delivered orders */}
                            {isDelivered && it.product_id && (
                              alreadyReviewed ? (
                                <div className="mt-1 text-[11px] text-emerald-600 font-medium">
                                  ✓ Reviewed
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleReview(it.product_id, o.id)}
                                  className="mt-1 text-[11px] font-semibold text-amber-600 hover:text-amber-800 transition"
                                >
                                  {reviewOpen ? "▲ Close review" : "★ Write a review"}
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        <div className="text-sm font-semibold text-neutral-950 shrink-0">
                          {money(it.line_total_inr)}
                        </div>
                      </div>

                      {/* Inline review form */}
                      {isDelivered && reviewOpen && !alreadyReviewed && (
                        <InlineReviewForm
                          productId={it.product_id}
                          orderId={o.id}
                          productName={it.product_name || "this product"}
                          onDone={() => onReviewDone(it.product_id, o.id)}
                        />
                      )}
                    </div>
                  );
                })}

                <div className="pt-1 text-xs text-neutral-500">
                  Placed on: {o.created_at ? new Date(o.created_at).toLocaleString() : "-"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

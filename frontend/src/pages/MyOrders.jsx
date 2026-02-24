/**
 * MyOrders.jsx — Order history page for authenticated users.
 *
 * Fetches the user's orders (with items) from Supabase, supports status
 * filtering, search, order cancellation (placed/processing only), and
 * inline product reviews for delivered orders. Reviews are submitted to
 * the `product_reviews` table with duplicate protection.
 *
 * @module pages/MyOrders
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../services/supabase/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import SEO from "../components/SEO";
import { SkeletonOrderCard } from "../components/Skeleton";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

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
      product_id: productId, user_id: user.id, order_id: orderId,
      rating, title: null, body: body.trim() || null,
    });
    setSubmitting(false);
    if (err) { setError(err.message?.includes("unique") || err.code === "23505" ? "Already reviewed." : err.message); return; }
    onDone();
  };

  const labels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

  return (
    <div className="mt-3 rounded-xl border border-[#E8E4DE] bg-stone-50 p-4 space-y-3">
      <p className="text-xs font-semibold text-stone-600">Rate your purchase — <span className="text-stone-900">{productName}</span></p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(0)} onClick={() => setRating(i)}
            className="text-2xl leading-none transition-transform hover:scale-110">
            <span className={i <= (hovered || rating) ? "text-amber-400" : "text-stone-200"}>★</span>
          </button>
        ))}
        {(hovered || rating) > 0 && (
          <span className="ml-2 text-xs font-semibold text-stone-500">{labels[hovered || rating]}</span>
        )}
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={1000}
        placeholder="Share your experience (optional)…"
        className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 resize-none transition" />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSubmit} disabled={submitting || !rating}
          className="btn-primary py-2 px-4 text-xs disabled:opacity-40">
          {submitting ? "Submitting…" : "Submit review"}
        </button>
        <button type="button" onClick={onDone} className="text-xs text-stone-400 hover:text-stone-600">Maybe later</button>
      </div>
    </div>
  );
}

const STATUS_STYLES = {
  placed: "bg-blue-50 text-blue-700 border border-blue-200",
  processing: "bg-amber-50 text-amber-700 border border-amber-200",
  shipped: "bg-violet-50 text-violet-700 border border-violet-200",
  delivered: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  cancelled: "bg-red-50 text-red-600 border border-red-200",
};

export default function MyOrders() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const userId = user?.id;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [reviewedKeys, setReviewedKeys] = useState(new Set());
  const [openReviews, setOpenReviews] = useState({});
  const [existingReviews, setExistingReviews] = useState(new Set());
  const [pendingCancelId, setPendingCancelId] = useState(null);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id,status,created_at,total_amount_inr,total_items,order_items(id,product_id,product_name,qty,unit_price_inr,line_total_inr,image_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setOrders(data || []);
    const { data: revData } = await supabase.from("product_reviews").select("product_id,order_id").eq("user_id", userId);
    setExistingReviews(new Set((revData || []).map((r) => `${r.product_id}_${r.order_id}`)));
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const onCancel = async (orderId, status) => {
    if (["shipped", "delivered"].includes(status.toLowerCase())) {
      showToast("Cannot cancel after shipment.", "warning");
      return;
    }
    // Use inline confirmation via pendingCancelId
    setPendingCancelId(orderId);
  };

  const confirmCancel = async (orderId) => {
    const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId, p_user_id: userId });
    setPendingCancelId(null);
    if (error) { showToast(error.message, "error"); return; }
    showToast("Order cancelled", "info");
    load();
  };

  const filtered = orders.filter((o) => {
    const s = (o.status || "").toLowerCase();
    if (statusFilter !== "all" && s !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return String(o.id).toLowerCase().includes(q) ||
      new Date(o.created_at).toLocaleString().toLowerCase().includes(q) ||
      (o.order_items || []).some((it) => (it.product_name || "").toLowerCase().includes(q));
  });

  const STATUS_OPTIONS = ["all", "placed", "processing", "shipped", "delivered", "cancelled"];

  return (
    <div>
      <SEO title="My Orders | Core Atoms" description="Track and manage all your orders." />
      {/* Header */}
      <div className="mb-8">
        <p className="section-label">Account</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-stone-900">My Orders</h1>
        <p className="mt-1 text-sm text-stone-500">Track and manage all your orders.</p>
      </div>

      {/* Filters */}
      <div className="card p-5 mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1">
            {STATUS_OPTIONS.map((s) => (
              <button key={s} type="button" onClick={() => setStatusFilter(s)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border capitalize transition-all ${statusFilter === s ? "bg-[#1e3a5f] border-[#1e3a5f] text-white" : "bg-white border-[#E8E4DE] text-stone-500 hover:border-stone-300"
                  }`}
              >
                {s === "all" ? "All orders" : s}
              </button>
            ))}
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders…"
            className="input sm:w-52" />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-stone-400">{filtered.length} order{filtered.length !== 1 ? "s" : ""}</p>
          {(statusFilter !== "all" || search) && (
            <button type="button" onClick={() => { setStatusFilter("all"); setSearch(""); }} className="text-xs text-[#1e3a5f] hover:underline">Clear filters</button>
          )}
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <SkeletonOrderCard key={i} />)}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card p-12 text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-stone-100 grid place-items-center">
            <svg className="h-5 w-5 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
          <p className="font-semibold text-stone-900">No orders found</p>
          <p className="mt-1 text-sm text-stone-500">{statusFilter !== "all" || search ? "Try clearing your filters." : "Place your first order from our shop."}</p>
          {!(statusFilter !== "all" || search) && <Link to="/shop" className="btn-primary mt-5 inline-flex">Browse products</Link>}
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((o) => {
          const items = o.order_items || [];
          const totalAmount = Number(o.total_amount_inr || items.reduce((s, it) => s + Number(it.line_total_inr || 0), 0));
          const totalCount = Number(o.total_items || items.reduce((s, it) => s + Number(it.qty || 0), 0));
          const status = (o.status || "placed").toLowerCase();
          const isDelivered = status === "delivered";
          const cancellable = ["placed", "processing"].includes(status);
          const statusCls = STATUS_STYLES[status] || "bg-stone-100 text-stone-600 border border-stone-200";

          return (
            <div key={o.id} className="card p-6">
              {/* Order header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-stone-400 mb-1">Order ID</p>
                  <p className="font-semibold text-stone-900 font-mono text-sm">{String(o.id).slice(0, 8).toUpperCase()}</p>
                  <p className="text-xs text-stone-400 mt-1">{o.created_at ? new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize ${statusCls}`}>{o.status}</span>
                  {cancellable && pendingCancelId === o.id ? (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => confirmCancel(o.id)}
                        className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 transition">Confirm cancel</button>
                      <button type="button" onClick={() => setPendingCancelId(null)}
                        className="text-xs text-stone-400 hover:text-stone-600 transition">Keep</button>
                    </div>
                  ) : cancellable && (
                    <button type="button" onClick={() => onCancel(o.id, o.status)} className="btn-ghost py-1 px-3 text-xs">Cancel</button>
                  )}
                </div>
              </div>

              {/* Summary row */}
              <div className="mt-4 flex items-center gap-6 text-sm border-t border-[#E8E4DE] pt-4">
                <div><span className="text-stone-400 text-xs block">Total</span><span className="font-semibold text-stone-900">{money(totalAmount)}</span></div>
                <div><span className="text-stone-400 text-xs block">Items</span><span className="font-semibold text-stone-900">{totalCount}</span></div>
                <div><span className="text-stone-400 text-xs block">Payment</span><span className="font-semibold text-stone-900">COD</span></div>
              </div>

              {/* Items */}
              <div className="mt-4 space-y-3 border-t border-[#E8E4DE] pt-4">
                {items.map((it) => {
                  const reviewKey = `${it.product_id}_${o.id}`;
                  const alreadyReviewed = existingReviews.has(reviewKey) || reviewedKeys.has(reviewKey);
                  const reviewOpen = openReviews[reviewKey];

                  return (
                    <div key={it.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {it.image_url && (
                            <div className="h-12 w-12 rounded-xl border border-[#E8E4DE] bg-stone-50 overflow-hidden shrink-0">
                              <img src={it.image_url} alt={it.product_name} className="h-full w-full object-cover" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-stone-900 truncate">{it.product_name || "Product"} <span className="text-stone-400 font-normal">×{it.qty}</span></p>
                            <p className="text-xs text-stone-400">{money(it.unit_price_inr)} each</p>
                            {isDelivered && it.product_id && (
                              alreadyReviewed
                                ? <p className="text-[11px] text-emerald-600 font-medium mt-0.5">✓ Reviewed</p>
                                : <button type="button" onClick={() => setOpenReviews(p => ({ ...p, [reviewKey]: !p[reviewKey] }))}
                                  className="text-[11px] font-semibold text-[#1e3a5f] hover:underline mt-0.5 block">
                                  {reviewOpen ? "▲ Close" : "★ Write a review"}
                                </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-stone-900 shrink-0">{money(it.line_total_inr)}</p>
                      </div>
                      {isDelivered && reviewOpen && !alreadyReviewed && (
                        <InlineReviewForm productId={it.product_id} orderId={o.id} productName={it.product_name || "product"}
                          onDone={() => {
                            setOpenReviews(p => ({ ...p, [reviewKey]: false }));
                            setReviewedKeys(p => new Set([...p, reviewKey]));
                            setExistingReviews(p => new Set([...p, reviewKey]));
                          }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

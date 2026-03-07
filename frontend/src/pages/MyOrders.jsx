/**
 * MyOrders.jsx — Order history page for authenticated users.
 *
 * Fetches orders (with order_items, shipping_amount, gst_amount, coins_used)
 * from Supabase ordered newest-first. Features:
 *
 *  - Itemised bill breakdown per order (items → shipping → GST → CoreCoins → total)
 *  - Order status timeline (placed → shipped → out for delivery → delivered)
 *  - Live Delhivery tracking via ShipmentTracker component
 *  - Order cancellation (placed / processing only)
 *  - Inline product review form for delivered orders
 *  - Replacement request form with image upload (delivered orders, within window)
 *  - 'Payment Failed' banner with retry + support CTA for failed Razorpay orders
 *  - CoreCoins: pending-coin processing via `process_pending_corecoins` RPC
 *
 * STATUS values: placed | processing | shipped | out_for_delivery | delivered | cancelled | payment_failed
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
import OrderTimeline from "../components/OrderTimeline";
import ShipmentTracker from "../components/ShipmentTracker";
import ScrollReveal from "../components/ScrollReveal";


import { money } from "../utils/format";

const REPLACEMENT_REASONS = [
  "Damaged in transit",
  "Wrong product received",
  "Missing items",
  "Defective product",
  "Other",
];

const REPLACEMENT_STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  pickup_scheduled: "bg-blue-50 text-blue-700 border border-blue-200",
  pickup_received: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  replacement_shipped: "bg-teal-50 text-teal-700 border border-teal-200",
  rejected: "bg-red-50 text-red-600 border border-red-200",
};

const REPLACEMENT_STATUS_LABELS = {
  pending: "Pending Review",
  approved: "Approved",
  pickup_scheduled: "Pickup Scheduled",
  pickup_received: "Pickup Received",
  replacement_shipped: "Replacement Shipped",
  rejected: "Rejected",
};

function InlineReviewForm({ productId, orderId, productName, onDone }) {
  const { user, profile } = useAuth();
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
      reviewer_name: profile?.full_name || user.email?.split("@")[0] || "Customer",
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

function InlineReplacementForm({ orderId, userId, onDone }) {
  const { showToast } = useToast();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleFiles = (e) => {
    const selected = Array.from(e.target.files || []);
    const allowed = selected.slice(0, 3 - files.length);
    const newFiles = [...files, ...allowed].slice(0, 3);
    setFiles(newFiles);
    setPreviews(newFiles.map((f) => URL.createObjectURL(f)));
  };

  const removeFile = (idx) => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    const nf = files.filter((_, i) => i !== idx);
    setFiles(nf);
    setPreviews(nf.map((f) => URL.createObjectURL(f)));
  };

  const handleSubmit = async () => {
    if (!reason) { showToast("Please select a reason.", "error"); return; }
    setSubmitting(true);

    // Upload images
    const imageUrls = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("replacement-images")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        showToast(`Upload failed: ${upErr.message}`, "error");
        setSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage
        .from("replacement-images")
        .getPublicUrl(path);
      imageUrls.push(urlData.publicUrl);
    }

    // Insert replacement request
    const { error } = await supabase.from("replacements").insert({
      order_id: orderId,
      user_id: userId,
      reason,
      description: description.trim() || null,
      images: imageUrls,
    });

    if (error) {
      showToast(
        error.message?.includes("idx_replacements_order")
          ? "A replacement request already exists for this order."
          : error.message,
        "error"
      );
    } else {
      showToast("Replacement request submitted!", "success");
      onDone();
    }
    setSubmitting(false);
  };

  return (
    <div className="mt-4 rounded-xl border border-[#E8E4DE] bg-stone-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-stone-800">Request Replacement</p>

      {/* Reason */}
      <div>
        <label className="text-xs text-stone-500 block mb-1">Reason *</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 transition"
        >
          <option value="">Select a reason…</option>
          {REPLACEMENT_REASONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs text-stone-500 block mb-1">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Describe the issue in detail…"
          className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-[#1e3a5f]/10 resize-none transition"
        />
      </div>

      {/* Image upload */}
      <div>
        <label className="text-xs text-stone-500 block mb-1">Damage Photos (up to 3)</label>
        {previews.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {previews.map((src, i) => (
              <div key={i} className="relative h-20 w-20 rounded-xl border border-[#E8E4DE] overflow-hidden group">
                <img src={src} alt={`Upload ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {files.length < 3 && (
          <label className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#E8E4DE] bg-white px-3 py-2 text-xs font-medium text-stone-500 hover:border-stone-400 hover:text-stone-700 cursor-pointer transition-colors">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            Add photo
            <input type="file" accept="image/*" onChange={handleFiles} className="hidden" />
          </label>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !reason}
          className="btn-primary py-2 px-5 text-xs disabled:opacity-40"
        >
          {submitting ? "Submitting…" : "Submit Request"}
        </button>
        <button type="button" onClick={onDone} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

const STATUS_STYLES = {
  placed: "bg-blue-50 text-blue-700 border border-blue-200",
  processing: "bg-amber-50 text-amber-700 border border-amber-200",
  shipped: "bg-violet-50 text-violet-700 border border-violet-200",
  out_for_delivery: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  delivered: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  cancelled: "bg-red-50 text-red-600 border border-red-200",
  payment_failed: "bg-red-100 text-red-700 border border-red-300",
};

const STATUS_LABELS = {
  placed: "Placed",
  processing: "Processing",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  payment_failed: "Payment Failed",
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

  // Replacement state
  const [replacementsEnabled, setReplacementsEnabled] = useState(false);
  const [replacementWindowDays, setReplacementWindowDays] = useState(1);
  const [replacementWindowMinutes, setReplacementWindowMinutes] = useState(0);
  const [replacementMap, setReplacementMap] = useState({});  // order_id → replacement
  const [openReplacementForm, setOpenReplacementForm] = useState(null); // order_id or null
  const [warehouseState, setWarehouseState] = useState("Andhra Pradesh");

  // CoreCoins state
  const [corecoinsEnabled, setCorecoinsEnabled] = useState(false);
  const [coinBalance, setCoinBalance] = useState(0);
  const [corecoinsConfig, setCorecoinsConfig] = useState({ earn_rate: 1, earn_per_rupees: 100, coin_value_inr: 1 });


  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id,status,created_at,total_amount_inr,total_items,payment_method,razorpay_payment_id,delhivery_waybill,courier_name,tracking_url,shipped_at,delivered_at,coins_credited,coins_used,coins_credit_after,shipping_amount,gst_amount,discount_amount,coupon_code,shipping_address,order_items(id,product_id,product_name,qty,unit_price_inr,line_total_inr,image_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setOrders(data || []);
    const { data: revData } = await supabase.from("product_reviews").select("product_id,order_id").eq("user_id", userId);
    setExistingReviews(new Set((revData || []).map((r) => `${r.product_id}_${r.order_id}`)));

    // Fetch replacements setting
    const { data: settingData } = await supabase
      .from("app_settings").select("value")
      .eq("key", "replacements_enabled").maybeSingle();
    setReplacementsEnabled(settingData?.value?.enabled === true);
    if (settingData?.value?.window_days) setReplacementWindowDays(settingData.value.window_days);
    if (settingData?.value?.window_minutes != null) setReplacementWindowMinutes(Number(settingData.value.window_minutes) || 0);

    // Fetch warehouse state for GST split display
    const { data: whData } = await supabase
      .from("app_settings").select("value")
      .eq("key", "warehouse_address").maybeSingle();
    if (whData?.value?.state) setWarehouseState(whData.value.state.trim());

    // Fetch existing replacement requests for this user
    const { data: repData } = await supabase
      .from("replacements")
      .select("id,order_id,status,reason,admin_notes,created_at,replacement_waybill,replacement_tracking_url,reverse_waybill,reverse_tracking_url")
      .eq("user_id", userId);
    const map = {};
    (repData || []).forEach((r) => { map[r.order_id] = r; });
    setReplacementMap(map);

    // Fetch CoreCoins balance
    const { data: ccSetting } = await supabase
      .from("app_settings").select("value")
      .eq("key", "corecoins_enabled").maybeSingle();
    const ccEnabled = ccSetting?.value?.enabled === true;
    setCorecoinsEnabled(ccEnabled);
    if (ccEnabled) {
      const { data: walletData } = await supabase
        .from("corecoins_wallet").select("balance")
        .eq("user_id", userId).maybeSingle();
      setCoinBalance(Number(walletData?.balance || 0));

      // Load coins config for pending coins preview
      const { data: ccConfig } = await supabase
        .from("app_settings").select("value")
        .eq("key", "corecoins_config").maybeSingle();
      if (ccConfig?.value) setCorecoinsConfig(ccConfig.value);

      // Credit any pending CoreCoins whose replacement window has now closed
      const { data: creditResult, error: creditError } = await supabase.rpc("process_pending_corecoins", { p_user_id: userId });
      if (creditError) console.error("process_pending_corecoins error:", creditError);
      // coins credited silently — no debug logging in production
      // Re-fetch balance in case coins were just credited
      const { data: freshWallet } = await supabase
        .from("corecoins_wallet").select("balance")
        .eq("user_id", userId).maybeSingle();
      setCoinBalance(Number(freshWallet?.balance || 0));
    }

    setLoading(false);
  };


  useEffect(() => { load(); }, [userId]);


  const filtered = orders.filter((o) => {
    const s = (o.status || "").toLowerCase();
    if (statusFilter !== "all" && s !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return String(o.id).toLowerCase().includes(q) ||
      new Date(o.created_at).toLocaleString().toLowerCase().includes(q) ||
      (o.order_items || []).some((it) => (it.product_name || "").toLowerCase().includes(q));
  });

  // Pagination
  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [statusFilter, search]);

  const STATUS_OPTIONS = ["all", "placed", "processing", "shipped", "delivered", "cancelled"];

  return (
    <div>
      <SEO title="My Orders | Core Atoms" description="Track and manage all your orders." />
      {/* Header */}
      <ScrollReveal>
        <div className="mb-8">
          <p className="section-label">Account</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-stone-900">My Orders</h1>
          <p className="mt-1 text-sm text-stone-500">Track and manage all your orders.</p>
        </div>
      </ScrollReveal>

      {/* CoreCoins balance card */}
      {corecoinsEnabled && (
        <ScrollReveal>
          <div className="mb-6 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4"
            style={{ boxShadow: "0 2px 12px rgba(217, 119, 6, 0.08)" }}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
                <span className="text-lg">🪙</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Your CoreCoins</p>
                <p className="text-xl font-bold text-stone-900">
                  {coinBalance} <span className="text-sm font-medium text-stone-500">coin{coinBalance !== 1 ? "s" : ""}</span>
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-[11px] text-amber-600">Earn coins on every purchase.</p>
                <p className="text-[11px] text-amber-600">Redeem at checkout for discounts!</p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* Filters — Premium glass bar */}
      <div
        className="mb-6 rounded-2xl p-4 sm:p-5"
        style={{
          background: "rgba(255,255,255,0.75)",
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
          border: "1px solid rgba(232,228,222,0.6)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.9)",
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Status filters + search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 flex-1 min-w-0">
            {/* Status pills — horizontally scrollable on mobile */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {STATUS_OPTIONS.map((s) => (
                <button key={s} type="button" onClick={() => setStatusFilter(s)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border capitalize transition-all duration-200 ${statusFilter === s
                    ? "bg-[#1e3a5f] border-[#1e3a5f] text-white shadow-[0_2px_8px_rgba(30,58,95,0.25)]"
                    : "bg-white/90 border-[#E8E4DE]/80 text-stone-500 hover:border-stone-300 hover:text-stone-700"
                    }`}
                >
                  {s === "all" ? "All orders" : s}
                </button>
              ))}
            </div>

            {/* Search with integrated icon */}
            <div className="relative group shrink-0">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="h-4 w-4 text-stone-400 group-focus-within:text-[#1e3a5f] transition-colors" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders…"
                className="w-full sm:w-48 rounded-xl border border-[#E8E4DE]/80 bg-white/90 pl-10 pr-4 py-2 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition-all duration-200 focus:border-[#1e3a5f]/40 focus:ring-[3px] focus:ring-[#1e3a5f]/8 focus:bg-white hover:border-stone-300"
                style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)" }}
              />
            </div>
          </div>

          {/* Right: Order count pill + clear filters */}
          <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
            {(statusFilter !== "all" || search) && (
              <button type="button" onClick={() => { setStatusFilter("all"); setSearch(""); }}
                className="text-xs font-medium text-[#1e3a5f] hover:underline underline-offset-2 transition-colors">
                Clear filters
              </button>
            )}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E4DE]/60 bg-white/80 px-3 py-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#1e3a5f]/50" />
              <span className="text-xs font-medium text-stone-500">
                {filtered.length} order{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
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
        {paginated.map((o) => {
          const items = o.order_items || [];
          const totalAmount = Number(o.total_amount_inr || items.reduce((s, it) => s + Number(it.line_total_inr || 0), 0));
          const totalCount = Number(o.total_items || items.reduce((s, it) => s + Number(it.qty || 0), 0));
          const status = (o.status || "placed").toLowerCase();
          const isDelivered = status === "delivered";
          const isPrepaid = o.payment_method === "prepaid";
          const statusCls = STATUS_STYLES[status] || "bg-stone-100 text-stone-600 border border-stone-200";
          const txnId = o.razorpay_payment_id;

          // Build WhatsApp support message with product details
          const itemsList = items.map((it) => `• ${it.product_name || "Product"} ×${it.qty} — ${money(it.unit_price_inr)}`).join("%0A");
          const waMsg = `Hi, I need help with my order.%0A%0AOrder ID: ${String(o.id).slice(0, 8).toUpperCase()}%0AStatus: ${o.status}%0APayment: ${isPrepaid ? "Prepaid" : "COD"}${isPrepaid && txnId ? `%0ATransaction ID: ${txnId}` : ""}%0ATotal: ${money(totalAmount)}%0A%0AItems:%0A${itemsList}`;
          const waUrl = `https://wa.me/918331833102?text=${waMsg}`;

          return (
            <ScrollReveal key={o.id}>
              <div key={o.id} className="card p-6">
                {/* Order header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-stone-400 mb-1">Order ID</p>
                    <p className="font-semibold text-stone-900 font-mono text-sm">{String(o.id).slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-stone-400 mt-1">{o.created_at ? new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize ${statusCls}`}>
                      {STATUS_LABELS[status] || o.status}
                    </span>
                    {isPrepaid && status !== "payment_failed" && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ✓ Paid
                      </span>
                    )}
                  </div>
                </div>

                {/* Payment failed alert */}
                {status === "payment_failed" && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
                    <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-700">Payment could not be processed</p>
                      <p className="text-xs text-red-500 mt-0.5">Your payment was not captured. No amount has been deducted. Please try placing your order again.</p>
                      <div className="mt-2 flex gap-2">
                        <a href="/checkout" className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition">Try again →</a>
                        <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition">Contact support</a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Order tracking timeline — hide for failed orders */}
                {status !== "payment_failed" && (
                  <div className="mt-4 border-t border-[#E8E4DE] pt-2">
                    <OrderTimeline status={status} />
                  </div>
                )}

                {/* Delhivery tracking — shown when waybill exists */}
                {o.delhivery_waybill && (
                  <div className="border-t border-[#E8E4DE] pt-3">
                    <ShipmentTracker waybill={o.delhivery_waybill} trackingUrl={o.tracking_url} orderId={o.id} onStatusSync={(newStatus) => setOrders(prev => prev.map(ord => ord.id === o.id ? { ...ord, status: newStatus } : ord))} />
                  </div>
                )}

                {/* Bill breakdown */}
                <div className="mt-4 border-t border-[#E8E4DE] pt-4 space-y-3">

                  {/* Items list */}
                  <div className="space-y-1.5">
                    {items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-stone-600 truncate max-w-[55%]">
                          {it.product_name || "Product"} <span className="text-stone-400">×{it.qty}</span>
                        </span>
                        <span className="font-medium text-stone-800 ml-2">{money(Number(it.line_total_inr || it.unit_price_inr * it.qty || 0))}</span>
                      </div>
                    ))}
                  </div>

                  {/* Charges breakdown */}
                  <div className="border-t border-dashed border-[#E8E4DE] pt-2 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-400">Items subtotal</span>
                      <span className="text-stone-600">{money(items.reduce((s, it) => s + Number(it.line_total_inr || 0), 0))}</span>
                    </div>
                    {(() => {
                      const shippingAmt = Number(o.shipping_amount ?? 0);
                      const gstAmt = Number(o.gst_amount ?? 0);
                      const itemsSubtotal = items.reduce((s, it) => s + Number(it.line_total_inr || 0), 0);
                      const coinsUsedN = Number(o.coins_used || 0);
                      // derive shipping+gst for old orders where column is 0
                      const hasStored = shippingAmt > 0 || gstAmt > 0;
                      const derivedExtra = !hasStored && itemsSubtotal > 0 && totalAmount > 0
                        ? Math.max(0, totalAmount + coinsUsedN - itemsSubtotal)
                        : null;
                      return (
                        <>
                          {hasStored ? (
                            <>
                              {shippingAmt > 0 ? (
                                <div className="flex justify-between text-xs">
                                  <span className="text-stone-400">Shipping</span>
                                  <span className="text-stone-600">{money(shippingAmt)}</span>
                                </div>
                              ) : (
                                <div className="flex justify-between text-xs">
                                  <span className="text-stone-400">Shipping</span>
                                  <span className="text-emerald-600 font-medium">Free</span>
                                </div>
                              )}
                              {gstAmt > 0 && (() => {
                                const orderState = (o.shipping_address?.state || "").trim();
                                const isIntra = orderState.toLowerCase() === warehouseState.toLowerCase();
                                const halfAmt = Math.round(gstAmt / 2);
                                return isIntra ? (
                                  <>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-stone-400">CGST</span>
                                      <span className="text-stone-600">{money(halfAmt)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-stone-400">SGST</span>
                                      <span className="text-stone-600">{money(gstAmt - halfAmt)}</span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex justify-between text-xs">
                                    <span className="text-stone-400">IGST</span>
                                    <span className="text-stone-600">{money(gstAmt)}</span>
                                  </div>
                                );
                              })()}
                            </>
                          ) : derivedExtra !== null && derivedExtra > 0 ? (
                            <div className="flex justify-between text-xs">
                              <span className="text-stone-400">Shipping + GST</span>
                              <span className="text-stone-600">{money(derivedExtra)}</span>
                            </div>
                          ) : null}
                          {coinsUsedN > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-amber-600 flex items-center gap-1">
                                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" /></svg>
                                CoreCoins ({coinsUsedN})
                              </span>
                              <span className="text-amber-700">−{money(coinsUsedN)}</span>
                            </div>
                          )}
                          {Number(o.discount_amount ?? 0) > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-emerald-600">
                                🎉 Discount{o.coupon_code ? <> (<span className="font-mono font-bold">{o.coupon_code}</span>)</> : ""}
                              </span>
                              <span className="text-emerald-700 font-medium">−{money(Number(o.discount_amount))}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Total + meta row */}
                  <div className="border-t border-[#E8E4DE] pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-stone-400">Total paid</span>
                      <span className="text-base font-bold text-stone-900">{money(totalAmount)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${isPrepaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                        {isPrepaid ? '💳 Online' : '💵 COD'}
                      </span>
                      <a href={waUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1.5 text-[11px] font-semibold text-green-700 hover:bg-green-100 transition-colors">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.555 4.125 1.527 5.86L.05 23.706a.5.5 0 00.607.607l5.845-1.477A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 01-5.38-1.574l-.386-.232-3.466.877.893-3.467-.24-.394A9.94 9.94 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
                        </svg>
                        Support
                      </a>
                    </div>
                  </div>

                  {/* Razorpay ID */}
                  {isPrepaid && txnId && (
                    <p className="text-[10px] text-stone-400">
                      Payment ID: <span className="font-mono text-stone-500">{txnId}</span>
                    </p>
                  )}
                </div>

                {/* ── Replacement section for delivered orders ── */}
                {isDelivered && (() => {
                  const existing = replacementMap[o.id];
                  if (existing) {
                    return (
                      <div className="mt-4 border-t border-[#E8E4DE] pt-4">
                        <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="h-4 w-4 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs font-semibold text-stone-700">Replacement Request</span>
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${REPLACEMENT_STATUS_STYLES[existing.status] || "bg-stone-100 text-stone-500"}`}>
                              {REPLACEMENT_STATUS_LABELS[existing.status] || existing.status}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500">Reason: {existing.reason}</p>
                          {existing.admin_notes && (
                            <p className="text-xs text-stone-500 mt-1">
                              <span className="font-medium text-stone-600">Admin notes:</span> {existing.admin_notes}
                            </p>
                          )}
                          {existing.reverse_waybill && (
                            <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                              <p className="text-xs font-medium text-blue-700">
                                Reverse pickup — AWB: <span className="font-mono">{existing.reverse_waybill}</span>
                              </p>
                              {existing.reverse_tracking_url && (
                                <a
                                  href={existing.reverse_tracking_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-blue-700 hover:underline"
                                >
                                  Track reverse pickup ↗
                                </a>
                              )}
                            </div>
                          )}
                          {existing.replacement_waybill && (
                            <div className="mt-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2">
                              <p className="text-xs font-medium text-teal-700">
                                Replacement shipped — AWB: <span className="font-mono">{existing.replacement_waybill}</span>
                              </p>
                              {existing.replacement_tracking_url && (
                                <a
                                  href={existing.replacement_tracking_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-teal-700 hover:underline"
                                >
                                  Track your replacement ↗
                                </a>
                              )}
                            </div>
                          )}
                          <p className="text-[11px] text-stone-400 mt-1">
                            Submitted {new Date(existing.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  if (replacementsEnabled) {
                    const deliveredAt = o.delivered_at ? new Date(o.delivered_at) : null;
                    // Use the actual DB-computed timestamp (respects window_minutes)
                    // Falls back to client-side calculation if coins_credit_after isn't set
                    const windowCloses = o.coins_credit_after
                      ? new Date(o.coins_credit_after)
                      : deliveredAt
                        ? new Date(deliveredAt.getTime() + (
                          replacementWindowMinutes > 0
                            ? replacementWindowMinutes * 60 * 1000
                            : replacementWindowDays * 24 * 60 * 60 * 1000
                        ))
                        : null;
                    const windowOpen = windowCloses ? new Date() < windowCloses : true;

                    // Format countdown
                    const getCountdown = () => {
                      if (!windowCloses) return null;
                      const diff = windowCloses - new Date();
                      if (diff <= 0) return null;
                      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                      if (d > 0) return `${d}d ${h}h left`;
                      if (h > 0) return `${h}h ${m}m left`;
                      return `${m}m left`;
                    };
                    const countdown = getCountdown();

                    return (
                      <div className="mt-4 border-t border-[#E8E4DE] pt-4">
                        {windowOpen ? (
                          openReplacementForm === o.id ? (
                            <InlineReplacementForm
                              orderId={o.id}
                              userId={userId}
                              onDone={() => { setOpenReplacementForm(null); load(); }}
                            />
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              <button
                                type="button"
                                onClick={() => setOpenReplacementForm(o.id)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8E4DE] bg-white px-3.5 py-2 text-xs font-semibold text-stone-600 hover:border-stone-400 hover:text-stone-800 transition-all w-fit"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                </svg>
                                Request Replacement
                              </button>
                              {countdown && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                  </svg>
                                  Replacement window closes in {countdown}
                                </span>
                              )}
                              {/* Pending coins preview */}
                              {corecoinsEnabled && !o.coins_credited && (() => {
                                const netPaid = (o.total_amount_inr || 0) - ((o.coins_used || 0) * (corecoinsConfig.coin_value_inr || 1));
                                const pending = Math.floor(netPaid * (corecoinsConfig.earn_rate || 1) / (corecoinsConfig.earn_per_rupees || 100));
                                if (pending <= 0) return null;
                                return (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-stone-500">
                                    <svg className="h-3 w-3 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12zm.75-8.25a.75.75 0 00-1.5 0v3.5l2.25 1.5a.75.75 0 00.75-1.3L10.75 10V7.75z" />
                                    </svg>
                                    <span><strong>{pending} CoreCoins</strong> will be added once the replacement window closes</span>
                                  </span>
                                );
                              })()}
                            </div>
                          )
                        ) : (
                          <p className="text-[11px] text-stone-400">
                            Replacement window has closed for this order.
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

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
            </ScrollReveal>
          );
        })}
      </div>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="mt-6 flex items-center justify-between">
          <button type="button" onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo(0, 0); }} disabled={safePage <= 1}
            className="btn-ghost text-sm py-2 px-4 disabled:opacity-30 disabled:cursor-not-allowed">← Previous</button>
          <span className="text-sm text-stone-500">Page {safePage} of {totalPages}</span>
          <button type="button" onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo(0, 0); }} disabled={safePage >= totalPages}
            className="btn-ghost text-sm py-2 px-4 disabled:opacity-30 disabled:cursor-not-allowed">Next →</button>
        </div>
      )}
    </div>
  );
}

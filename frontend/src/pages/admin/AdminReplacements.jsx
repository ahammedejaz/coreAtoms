/**
 * AdminReplacements.jsx — Admin page for reviewing replacement requests.
 *
 * Shows all replacement requests with status filters, damage images,
 * approve/reject actions, and post-approval automation (ship replacement
 * directly or schedule reverse pickup first).
 *
 * @module pages/admin/AdminReplacements
 */
import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { useToast } from "../../context/ToastContext";
import { money } from "../../utils/format";

const STATUS_STYLES = {
    pending: "bg-amber-50 text-amber-700 border border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    pickup_scheduled: "bg-blue-50 text-blue-700 border border-blue-200",
    pickup_received: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    replacement_shipped: "bg-teal-50 text-teal-700 border border-teal-200",
    rejected: "bg-red-50 text-red-600 border border-red-200",
};

const STATUS_LABELS = {
    pending: "Pending",
    approved: "Approved",
    pickup_scheduled: "Pickup Scheduled",
    pickup_received: "Pickup Received",
    replacement_shipped: "Replacement Shipped",
    rejected: "Rejected",
};

export default function AdminReplacements({ onCountChange }) {
    const { showToast } = useToast();
    const [replacements, setReplacements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [expandedId, setExpandedId] = useState(null);
    const [adminNotes, setAdminNotes] = useState({});
    const [processing, setProcessing] = useState(null);
    const [lightboxImg, setLightboxImg] = useState(null);

    const load = async () => {
        const { data, error } = await supabase
            .from("replacements")
            .select(`
                *,
                orders (
                    id,
                    status,
                    total_amount_inr,
                    created_at,
                    payment_method,
                    shipping_address,
                    delhivery_waybill,
                    order_items (
                        product_name,
                        variant_label,
                        qty,
                        unit_price_inr
                    )
                ),
                profiles:user_id (
                    full_name,
                    email
                )
            `)
            .order("created_at", { ascending: false });

        if (error) {
            showToast(error.message, "error");
        } else {
            setReplacements(data || []);
            const pendingCount = (data || []).filter(r => r.status === "pending").length;
            onCountChange?.(pendingCount);
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const updateStatus = async (id, newStatus) => {
        setProcessing(id);
        const notes = adminNotes[id] || "";
        const { error } = await supabase
            .from("replacements")
            .update({
                status: newStatus,
                admin_notes: notes || null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", id);

        if (error) {
            showToast(error.message, "error");
        } else {
            showToast(
                newStatus === "approved"
                    ? "Replacement approved"
                    : newStatus === "rejected"
                        ? "Replacement rejected"
                        : `Status → ${STATUS_LABELS[newStatus] || newStatus}`,
                "success"
            );
            load();
        }
        setProcessing(null);
    };

    /* ── Ship replacement via Delhivery ── */
    const shipReplacement = async (replacement) => {
        setProcessing(replacement.id);
        try {
            const order = replacement.orders || {};
            const ship = order.shipping_address || {};
            const items = (order.order_items || []).map(it => ({
                name: it.product_name || "Product",
                qty: it.qty || 1,
                price: it.unit_price_inr || 0,
            }));

            const { data: result, error: fnErr } = await supabase.functions.invoke(
                "delhivery-create-shipment",
                {
                    body: {
                        order_id: order.id,
                        shipping_address: {
                            name: ship.fullName || ship.name || "Customer",
                            phone: ship.phone || ship.mobile || "",
                            address: [ship.line1 || ship.address1 || "", ship.line2 || ship.address2 || ""].filter(Boolean).join(", "),
                            city: ship.city || "",
                            state: ship.state || "",
                            pin: ship.pincode || ship.zip || "",
                            country: ship.country || "India",
                        },
                        items,
                        total_amount: order.total_amount_inr || 0,
                        payment_method: "prepaid", // Replacement is always prepaid (no COD)
                        weight: 500,
                    },
                }
            );

            if (fnErr) {
                let detail = fnErr.message || "Shipping failed";
                if (fnErr.context && typeof fnErr.context.json === "function") {
                    try {
                        const errBody = await fnErr.context.json();
                        detail = errBody?.error || errBody?.message || detail;
                    } catch (_) { }
                }
                throw new Error(detail);
            }

            if (!result?.success && !result?.waybill) {
                throw new Error(result?.error || "Shipping failed — no waybill returned");
            }

            // Update replacement with tracking info + new status
            const { error: dbErr } = await supabase
                .from("replacements")
                .update({
                    status: "replacement_shipped",
                    replacement_waybill: result.waybill,
                    replacement_tracking_url: result.tracking_url,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", replacement.id);

            if (dbErr) {
                showToast(dbErr.message, "error");
            } else {
                showToast(`Replacement shipped! AWB: ${result.waybill}`, "success");
                load();
            }
        } catch (err) {
            showToast(err.message || "Failed to ship replacement", "error");
        }
        setProcessing(null);
    };

    const markPickupScheduled = (id) => updateStatus(id, "pickup_scheduled");
    const markPickupReceived = (id) => updateStatus(id, "pickup_received");

    const filtered = filter === "all"
        ? replacements
        : replacements.filter(r => r.status === filter);

    const counts = {
        all: replacements.length,
        pending: replacements.filter(r => r.status === "pending").length,
        approved: replacements.filter(r => r.status === "approved").length,
        pickup_scheduled: replacements.filter(r => r.status === "pickup_scheduled").length,
        pickup_received: replacements.filter(r => r.status === "pickup_received").length,
        replacement_shipped: replacements.filter(r => r.status === "replacement_shipped").length,
        rejected: replacements.filter(r => r.status === "rejected").length,
    };

    if (loading) {
        return (
            <div className="py-12 text-center text-sm text-stone-400 animate-pulse">
                Loading replacement requests…
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* ── Filters ── */}
            <div className="flex flex-wrap gap-2">
                {["all", "pending", "approved", "pickup_scheduled", "pickup_received", "replacement_shipped", "rejected"].map(f => (
                    <button
                        key={f}
                        type="button"
                        onClick={() => setFilter(f)}
                        className={[
                            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                            filter === f
                                ? "bg-[#1e3a5f] text-white shadow-sm"
                                : "bg-stone-100 text-stone-500 hover:bg-stone-200",
                        ].join(" ")}
                    >
                        {STATUS_LABELS[f] || "All"} ({counts[f]})
                    </button>
                ))}
            </div>

            {/* ── Empty state ── */}
            {filtered.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#E8E4DE] p-10 text-center">
                    <p className="text-sm text-stone-400">
                        {filter === "all"
                            ? "No replacement requests yet."
                            : `No ${STATUS_LABELS[filter] || filter} requests.`}
                    </p>
                </div>
            )}

            {/* ── Replacement cards ── */}
            <div className="space-y-3">
                {filtered.map(r => {
                    const isExpanded = expandedId === r.id;
                    const profile = r.profiles || {};
                    const order = r.orders || {};
                    const items = order.order_items || [];

                    return (
                        <div
                            key={r.id}
                            className="rounded-2xl border border-[#E8E4DE] bg-white overflow-hidden transition-shadow hover:shadow-sm"
                        >
                            {/* Header row — always visible */}
                            <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : r.id)}
                                className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className={[
                                        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                                        STATUS_STYLES[r.status] || "bg-stone-100 text-stone-500",
                                    ].join(" ")}>
                                        {STATUS_LABELS[r.status] || r.status}
                                    </span>
                                    <div className="min-w-0">
                                        <span className="text-sm font-semibold text-stone-900">
                                            {profile.full_name || profile.email || "Customer"}
                                        </span>
                                        <span className="text-xs text-stone-400 ml-2">
                                            #{String(r.order_id).slice(0, 8)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-xs text-stone-400">
                                        {new Date(r.created_at).toLocaleDateString("en-IN", {
                                            day: "numeric", month: "short", year: "numeric"
                                        })}
                                    </span>
                                    <svg
                                        className={`h-4 w-4 text-stone-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                        viewBox="0 0 20 20" fill="currentColor"
                                    >
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </button>

                            {/* Expanded details */}
                            {isExpanded && (
                                <div className="border-t border-[#E8E4DE] px-5 py-4 space-y-4">
                                    {/* Reason & Description */}
                                    <div>
                                        <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Reason</div>
                                        <div className="text-sm font-semibold text-stone-800">{r.reason}</div>
                                        {r.description && (
                                            <p className="text-sm text-stone-600 mt-1 leading-relaxed">{r.description}</p>
                                        )}
                                    </div>

                                    {/* Damage images */}
                                    {r.images?.length > 0 && (
                                        <div>
                                            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
                                                Damage Photos ({r.images.length})
                                            </div>
                                            <div className="flex gap-2 flex-wrap">
                                                {r.images.map((url, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => setLightboxImg(url)}
                                                        className="h-24 w-24 rounded-xl border border-[#E8E4DE] overflow-hidden hover:shadow-md transition-shadow"
                                                    >
                                                        <img
                                                            src={url}
                                                            alt={`Damage ${i + 1}`}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Order details */}
                                    <div className="rounded-xl border border-[#E8E4DE] bg-stone-50 p-3">
                                        <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Order Details</div>
                                        <div className="space-y-1">
                                            {items.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between text-sm">
                                                    <span className="text-stone-700">
                                                        {item.product_name}
                                                        {item.variant_label && <span className="text-stone-400 ml-1">({item.variant_label})</span>}
                                                        <span className="text-stone-400 ml-1">×{item.qty}</span>
                                                    </span>
                                                    <span className="text-stone-600 font-medium">{money(item.unit_price_inr * item.qty)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-[#E8E4DE] flex items-center justify-between text-sm">
                                            <span className="font-semibold text-stone-700">Total</span>
                                            <span className="font-semibold text-stone-900">{money(order.total_amount_inr)}</span>
                                        </div>
                                        {order.delhivery_waybill && (
                                            <div className="mt-1 text-xs text-stone-400">
                                                Original AWB: <span className="font-mono">{order.delhivery_waybill}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Customer info */}
                                    <div className="text-xs text-stone-500">
                                        <span className="font-medium text-stone-700">{profile.full_name}</span>
                                        {profile.email && <span className="ml-2">{profile.email}</span>}
                                    </div>

                                    {/* Replacement tracking info */}
                                    {r.replacement_waybill && (
                                        <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
                                            <div className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Replacement Shipment</div>
                                            <div className="text-sm text-teal-800">
                                                AWB: <span className="font-mono font-medium">{r.replacement_waybill}</span>
                                            </div>
                                            {r.replacement_tracking_url && (
                                                <a
                                                    href={r.replacement_tracking_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-teal-700 hover:underline"
                                                >
                                                    Track on Delhivery ↗
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {/* ── Admin actions based on status ── */}

                                    {/* PENDING: Approve / Reject */}
                                    {r.status === "pending" && (
                                        <div className="space-y-3 pt-2 border-t border-[#E8E4DE]">
                                            <div>
                                                <label className="text-xs font-semibold text-stone-500 block mb-1">
                                                    Admin Notes (optional)
                                                </label>
                                                <textarea
                                                    value={adminNotes[r.id] || ""}
                                                    onChange={e => setAdminNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                                                    placeholder="Reason for decision..."
                                                    rows={2}
                                                    className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none resize-none"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => updateStatus(r.id, "approved")}
                                                    disabled={processing === r.id}
                                                    className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                                >
                                                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                    Approve Replacement
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => updateStatus(r.id, "rejected")}
                                                    disabled={processing === r.id}
                                                    className="flex-1 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                                >
                                                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* APPROVED: Two paths */}
                                    {r.status === "approved" && (
                                        <div className="space-y-3 pt-2 border-t border-[#E8E4DE]">
                                            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Next Step</div>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                <button
                                                    type="button"
                                                    onClick={() => shipReplacement(r)}
                                                    disabled={processing === r.id}
                                                    className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 px-4 py-3 text-sm font-semibold text-white hover:from-teal-700 hover:to-teal-800 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {processing === r.id ? (
                                                        <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Shipping…</>
                                                    ) : (
                                                        <>
                                                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /><path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" /></svg>
                                                            Ship Replacement Directly
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => markPickupScheduled(r.id)}
                                                    disabled={processing === r.id}
                                                    className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                                                    Schedule Reverse Pickup
                                                </button>
                                            </div>
                                            <p className="text-[11px] text-stone-400 leading-relaxed">
                                                <strong>Ship Directly</strong> — Severe damage, no need to pick up the product. Sends a new product immediately.<br />
                                                <strong>Reverse Pickup</strong> — Minor damage, arrange pickup of the damaged product first via Delhivery dashboard.
                                            </p>
                                        </div>
                                    )}

                                    {/* PICKUP_SCHEDULED: Mark received */}
                                    {r.status === "pickup_scheduled" && (
                                        <div className="space-y-3 pt-2 border-t border-[#E8E4DE]">
                                            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
                                                <strong>Reverse pickup is scheduled.</strong> Once the damaged product is received at your warehouse, mark it as received to proceed.
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => markPickupReceived(r.id)}
                                                disabled={processing === r.id}
                                                className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                            >
                                                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                                Mark Pickup Received
                                            </button>
                                        </div>
                                    )}

                                    {/* PICKUP_RECEIVED: Ship replacement */}
                                    {r.status === "pickup_received" && (
                                        <div className="space-y-3 pt-2 border-t border-[#E8E4DE]">
                                            <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-xs text-indigo-700">
                                                <strong>Damaged product received.</strong> Ready to ship the replacement.
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => shipReplacement(r)}
                                                disabled={processing === r.id}
                                                className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:from-teal-700 hover:to-teal-800 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {processing === r.id ? (
                                                    <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Shipping…</>
                                                ) : (
                                                    <>
                                                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /><path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" /></svg>
                                                        Ship Replacement
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {/* Show admin notes for resolved requests */}
                                    {!["pending", "approved"].includes(r.status) && r.admin_notes && (
                                        <div className="pt-2 border-t border-[#E8E4DE]">
                                            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Admin Notes</div>
                                            <p className="text-sm text-stone-600">{r.admin_notes}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Lightbox ── */}
            {lightboxImg && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setLightboxImg(null)}
                >
                    <button
                        type="button"
                        onClick={() => setLightboxImg(null)}
                        className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl font-bold z-50"
                    >
                        ✕
                    </button>
                    <img
                        src={lightboxImg}
                        alt="Damage evidence"
                        className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}

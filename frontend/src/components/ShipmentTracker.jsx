/**
 * ShipmentTracker.jsx — Delhivery order tracking timeline.
 *
 * Fetches real-time tracking data from the delhivery-track edge function
 * and displays a visual step-by-step timeline:
 *   Order Placed → Picked Up → In Transit → Out for Delivery → Delivered
 *   (or → Cancelled / RTO when applicable)
 *
 * Also auto-syncs the order status in the database when Delhivery
 * reports a terminal status (delivered, cancelled, RTO, shipped).
 *
 * @module components/ShipmentTracker
 */
import { useEffect, useState } from "react";
import { supabase } from "../services/supabase/client";

/** Canonical tracking stages in order */
const STAGES = [
    { key: "placed", label: "Order Placed", icon: "📦" },
    { key: "picked_up", label: "Picked Up", icon: "🏭" },
    { key: "in_transit", label: "In Transit", icon: "🚚" },
    { key: "out_for_delivery", label: "Out for Delivery", icon: "📍" },
    { key: "delivered", label: "Delivered", icon: "✅" },
];

/** Terminal / negative statuses that break out of the normal flow */
const NEGATIVE_STAGES = {
    cancelled: { label: "Cancelled", icon: "❌" },
    rto: { label: "Returned (RTO)", icon: "↩️" },
};

/**
 * Map Delhivery status codes / strings to our stage keys.
 * Delhivery uses StatusCode like "UD", "IT", "OT", "DL", "RT", "CN" etc.
 */
function mapStatusToStage(status, statusCode) {
    const s = (status || "").toLowerCase();
    const c = (statusCode || "").toUpperCase();

    // Terminal / negative states
    if (c === "CN" || c === "X-PNP" || s.includes("cancel") || s.includes("cancelled") || s.includes("not picked")) return "cancelled";
    if (c === "RT" || c === "RTO" || s.includes("rto") || s.includes("return")) return "rto";

    // Normal flow
    if (c === "DL" || s.includes("delivered")) return "delivered";
    if (c === "OT" || s.includes("out for delivery")) return "out_for_delivery";
    if (c === "IT" || s.includes("in transit") || s.includes("dispatched")) return "in_transit";
    if (c === "PP" || c === "UD" || s.includes("picked") || s.includes("manifested")) return "picked_up";
    return "placed";
}

/** Map Delhivery stage to our DB order status */
function stageToOrderStatus(stage) {
    switch (stage) {
        case "delivered": return "delivered";
        case "cancelled": return "cancelled";
        case "rto": return "cancelled";
        case "out_for_delivery": return "out_for_delivery";
        case "in_transit": return "shipped";
        case "picked_up": return "processing";
        default: return null; // no change
    }
}

export default function ShipmentTracker({ waybill, trackingUrl, orderId, onStatusSync }) {
    const [tracking, setTracking] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [expanded, setExpanded] = useState(false);

    const fetchTracking = async () => {
        if (!waybill) return;
        setLoading(true);
        setError("");

        try {
            const { data: result, error: fnErr } = await supabase.functions.invoke(
                "delhivery-track",
                { body: { waybill } }
            );



            if (fnErr) {
                let detail = fnErr.message || "Tracking failed";
                if (fnErr.context && typeof fnErr.context.json === "function") {
                    try {
                        const errBody = await fnErr.context.json();
                        detail = errBody?.error || errBody?.message || detail;
                    } catch (_) { }
                }
                throw new Error(detail);
            }

            if (!result) {
                throw new Error("No tracking data returned");
            }

            setTracking(result);

            // Auto-sync order status if we have an orderId (separate try/catch so it doesn't break tracking display)
            // Only sync FORWARD — never downgrade status (e.g. shipped → processing)
            if (orderId && result) {
                try {
                    const STATUS_RANK = { placed: 0, processing: 1, shipped: 2, out_for_delivery: 3, delivered: 4, cancelled: 99 };
                    const stage = mapStatusToStage(result.status, result.status_code);
                    const newDbStatus = stageToOrderStatus(stage);


                    if (newDbStatus) {
                        // Fetch current order status from DB to compare
                        const { data: currentOrder } = await supabase
                            .from("orders")
                            .select("status")
                            .eq("id", orderId)
                            .single();

                        const currentRank = STATUS_RANK[currentOrder?.status] ?? -1;
                        const newRank = STATUS_RANK[newDbStatus] ?? -1;

                        // Only update if moving forward or to a terminal state (cancelled)
                        if (newRank > currentRank) {
                            const updateFields = { status: newDbStatus };
                            if (newDbStatus === "shipped") {
                                updateFields.shipped_at = new Date().toISOString();
                            }
                            if (newDbStatus === "delivered") {
                                updateFields.delivered_at = new Date().toISOString();
                            }
                            await supabase.from("orders").update(updateFields).eq("id", orderId);
                            if (onStatusSync) onStatusSync(newDbStatus);

                        } else {

                        }
                    }
                } catch (syncErr) {

                }
            }
        } catch (err) {

            setError(err.message || "Failed to fetch tracking");
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch on mount to sync status silently (runs once on page load)
    useEffect(() => {
        if (waybill && !tracking && !loading) {
            fetchTracking();
        }
    }, [waybill]);

    // Re-fetch when user manually expands (to get latest data)
    useEffect(() => {
        if (expanded && waybill) {
            fetchTracking();
        }
    }, [expanded]);

    const currentStage = tracking
        ? mapStatusToStage(tracking.status, tracking.status_code)
        : "placed";

    const isNegative = currentStage === "cancelled" || currentStage === "rto";
    const currentStageIndex = isNegative ? -1 : STAGES.findIndex((s) => s.key === currentStage);

    return (
        <div className="mt-4">
            {/* Toggle button */}
            <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="inline-flex items-center gap-2 text-sm font-medium text-[#1e3a5f] hover:text-[#1e3a5f]/80 transition-colors"
            >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                {expanded ? "Hide Tracking" : "Track Order"}
                <svg className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>

            {/* Tracking panel */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded ? "max-h-[800px] opacity-100 mt-4" : "max-h-0 opacity-0"}`}>
                {loading && (
                    <div className="flex items-center gap-2 py-4 text-sm text-stone-500">
                        <div className="h-4 w-4 rounded-full border-2 border-stone-200 border-t-[#1e3a5f] animate-spin" />
                        Fetching tracking info…
                    </div>
                )}

                {error && (
                    <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
                        {error}
                        <button onClick={fetchTracking} className="ml-2 underline">Retry</button>
                    </div>
                )}

                {tracking && !loading && (
                    <div className="rounded-2xl border border-[#E8E4DE] bg-white p-5 space-y-5">
                        {/* Header info */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold">Waybill</p>
                                <p className="text-sm font-mono font-medium text-stone-900 break-all">{tracking.waybill}</p>
                            </div>
                            <div className="sm:text-right">
                                <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold">Courier</p>
                                <p className="text-sm font-medium text-stone-900">{tracking.courier_name}</p>
                            </div>
                            {tracking.expected_delivery && (
                                <div className="sm:text-right">
                                    <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold">Expected Delivery</p>
                                    <p className="text-sm font-medium text-stone-900">
                                        {new Date(tracking.expected_delivery).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Cancelled / RTO banner */}
                        {isNegative && (
                            <div className={`rounded-xl p-3 ${currentStage === "cancelled" ? "bg-red-50 border border-red-200" : "bg-orange-50 border border-orange-200"}`}>
                                <p className={`text-sm font-semibold ${currentStage === "cancelled" ? "text-red-700" : "text-orange-700"}`}>
                                    {NEGATIVE_STAGES[currentStage].icon} {NEGATIVE_STAGES[currentStage].label}
                                </p>
                                <p className={`text-xs mt-0.5 ${currentStage === "cancelled" ? "text-red-600" : "text-orange-600"}`}>
                                    {tracking.status}
                                </p>
                                {tracking.status_datetime && (
                                    <p className="text-xs text-stone-400 mt-0.5">
                                        {new Date(tracking.status_datetime).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Stage progress bar (only for normal flow) */}
                        {!isNegative && (
                            <div className="relative">
                                <div className="flex items-center justify-between mb-2">
                                    {STAGES.map((stage, i) => {
                                        const isComplete = i <= currentStageIndex;
                                        const isCurrent = i === currentStageIndex;
                                        return (
                                            <div key={stage.key} className="flex flex-col items-center flex-1 min-w-0">
                                                <div className={`
                                                    h-6 w-6 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-xs sm:text-sm shrink-0
                                                    transition-all duration-300
                                                    ${isCurrent
                                                        ? "bg-[#1e3a5f] text-white ring-2 sm:ring-4 ring-[#1e3a5f]/15 scale-110"
                                                        : isComplete
                                                            ? "bg-emerald-500 text-white"
                                                            : "bg-stone-100 text-stone-400"
                                                    }
                                                `}>
                                                    {isComplete && !isCurrent ? "✓" : stage.icon}
                                                </div>
                                                <span className={`mt-1 sm:mt-1.5 text-[8px] sm:text-[10px] font-medium text-center leading-tight max-w-[48px] sm:max-w-none ${isCurrent ? "text-[#1e3a5f] font-semibold" : isComplete ? "text-emerald-600" : "text-stone-400"}`}>
                                                    {stage.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Progress line */}
                                <div className="absolute top-3 sm:top-4 left-[10%] right-[10%] h-0.5 bg-stone-100 -z-10">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-400 to-[#1e3a5f] transition-all duration-500"
                                        style={{ width: `${(currentStageIndex / (STAGES.length - 1)) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Current status (for non-negative) */}
                        {!isNegative && (
                            <div className="rounded-xl bg-[#1e3a5f]/5 p-3">
                                <p className="text-sm font-semibold text-[#1e3a5f]">
                                    {tracking.status}
                                </p>
                                {tracking.status_location && (
                                    <p className="text-xs text-stone-500 mt-0.5">📍 {tracking.status_location}</p>
                                )}
                                {tracking.status_datetime && (
                                    <p className="text-xs text-stone-400 mt-0.5">
                                        {new Date(tracking.status_datetime).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Scan timeline */}
                        {tracking.scans?.length > 0 && (
                            <details className="group">
                                <summary className="text-xs font-semibold text-stone-500 cursor-pointer hover:text-stone-700 transition-colors">
                                    View detailed timeline ({tracking.scans.length} events)
                                </summary>
                                <div className="mt-3 space-y-0 border-l-2 border-stone-200 ml-3 pl-4">
                                    {tracking.scans.map((scan, i) => (
                                        <div key={i} className="relative pb-4 last:pb-0">
                                            {/* Dot on the line */}
                                            <div className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${i === tracking.scans.length - 1 ? "bg-[#1e3a5f] ring-2 ring-[#1e3a5f]/20" : "bg-stone-300"}`} />
                                            <p className="text-xs font-medium text-stone-800">{scan.status}</p>
                                            {scan.location && <p className="text-[11px] text-stone-500">📍 {scan.location}</p>}
                                            {scan.instructions && <p className="text-[11px] text-stone-400">{scan.instructions}</p>}
                                            <p className="text-[10px] text-stone-400 mt-0.5">
                                                {scan.timestamp ? new Date(scan.timestamp).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}

                        {/* Refresh + External tracking link */}
                        <div className="flex items-center gap-4">
                            <button onClick={fetchTracking} className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-[#1e3a5f] transition-colors">
                                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                                Refresh
                            </button>
                            {trackingUrl && (
                                <a
                                    href={trackingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1e3a5f] hover:underline"
                                >
                                    Track on Delhivery website
                                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg>
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

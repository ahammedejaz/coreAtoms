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
import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardList, Package, Truck, MapPin, PackageCheck, X, Undo2, Check, ChevronDown, RefreshCw, ArrowUpRight } from "lucide-react";
import { supabase } from "../services/supabase/client";

/** A result younger than this is reused instead of re-hitting the edge function. */
const REFRESH_AFTER_MS = 60_000;

/** Canonical tracking stages in order */
const STAGES = [
    { key: "placed", label: "Order placed", icon: ClipboardList },
    { key: "picked_up", label: "Picked up", icon: Package },
    { key: "in_transit", label: "In transit", icon: Truck },
    { key: "out_for_delivery", label: "Out for delivery", icon: MapPin },
    { key: "delivered", label: "Delivered", icon: PackageCheck },
];

/** Terminal / negative statuses that break out of the normal flow */
const NEGATIVE_STAGES = {
    cancelled: { label: "Cancelled", icon: X },
    rto: { label: "Returned (RTO)", icon: Undo2 },
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

    const mountedRef = useRef(true);
    /** Guards against overlapping requests (mount fetch + an early expand). */
    const inFlightRef = useRef(false);
    /** `{ key, at }` of the last completed fetch, used for the freshness check. */
    const lastFetchRef = useRef({ key: null, at: 0 });
    /**
     * `onStatusSync` is typically an inline arrow from the orders list, so it
     * changes identity on every render. Held in a ref to keep `fetchTracking`
     * stable — otherwise the effects below would refire constantly.
     */
    const onStatusSyncRef = useRef(onStatusSync);

    useEffect(() => { onStatusSyncRef.current = onStatusSync; }, [onStatusSync]);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const fetchTracking = useCallback(async () => {
        if (!waybill || inFlightRef.current) return;
        inFlightRef.current = true;
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
                    } catch { /* ignore */ }
                }
                throw new Error(detail);
            }

            if (!result) {
                throw new Error("No tracking data returned");
            }

            if (!mountedRef.current) return;
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
                            onStatusSyncRef.current?.(newDbStatus);
                        }
                    }
                } catch { /* status sync is best-effort */ }
            }
        } catch (err) {
            if (mountedRef.current) setError(err.message || "Failed to fetch tracking");
        } finally {
            inFlightRef.current = false;
            lastFetchRef.current = { key: waybill, at: Date.now() };
            if (mountedRef.current) setLoading(false);
        }
    }, [waybill, orderId]);

    /**
     * Single fetch driver: runs on mount to sync the DB status silently, and
     * again on expand only when the cached result has gone stale. The two
     * separate effects this replaces fired a duplicate edge-function call on the
     * very first expand, and read stale closure state while doing it.
     */
    useEffect(() => {
        if (!waybill) return;
        const { key, at } = lastFetchRef.current;
        if (key === waybill && Date.now() - at < REFRESH_AFTER_MS) return;
        fetchTracking();
    }, [waybill, expanded, fetchTracking]);

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
                <MapPin className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                {expanded ? "Hide tracking" : "Track order"}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden="true" />
            </button>

            {/* Tracking panel — rendered rather than height-clipped, so a long
                scan list isn't silently truncated at 800px. */}
            {expanded && (
                <div className="mt-4 animate-toast-in">
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
                        <div className="space-y-5 rounded-2xl border border-line bg-bone/50 p-5">
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
                                    <p className={`flex items-center gap-1.5 text-sm font-semibold ${currentStage === "cancelled" ? "text-red-700" : "text-orange-700"}`}>
                                        {(() => { const Icon = NEGATIVE_STAGES[currentStage].icon; return <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />; })()}
                                        {NEGATIVE_STAGES[currentStage].label}
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
                                                            ? "bg-brand text-white ring-4 ring-brand/15"
                                                            : isComplete
                                                                ? "bg-emerald-600 text-white"
                                                                : "border border-line-strong bg-white text-stone-300"
                                                        }
                                                    `}>
                                                        {isComplete && !isCurrent
                                                            ? <Check className="h-3 w-3 sm:h-4 sm:w-4" strokeWidth={3} aria-hidden="true" />
                                                            : <stage.icon className="h-3 w-3 sm:h-4 sm:w-4" strokeWidth={1.75} aria-hidden="true" />}
                                                    </div>
                                                    <span className={`mt-1 sm:mt-1.5 text-[8px] sm:text-[10px] font-medium text-center leading-tight max-w-[48px] sm:max-w-none ${isCurrent ? "text-[#1e3a5f] font-semibold" : isComplete ? "text-emerald-600" : "text-stone-400"}`}>
                                                        {stage.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {/* Progress line */}
                                    <div className="absolute left-[10%] right-[10%] top-3 -z-10 h-px bg-line-strong sm:top-4">
                                        <div
                                            className="h-full bg-emerald-500 transition-[width] duration-500"
                                            style={{ width: `${(currentStageIndex / (STAGES.length - 1)) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Current status (for non-negative) */}
                            {!isNegative && (
                                <div className="rounded-xl bg-brand-soft p-3">
                                    <p className="text-sm font-semibold text-brand">
                                        {tracking.status}
                                    </p>
                                    {tracking.status_location && (
                                        <p className="mt-0.5 text-xs text-stone-500">{tracking.status_location}</p>
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
                                                {scan.location && <p className="text-[11px] text-stone-500">{scan.location}</p>}
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
                                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
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
                                        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

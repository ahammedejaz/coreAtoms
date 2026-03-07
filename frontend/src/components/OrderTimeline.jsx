/**
 * OrderTimeline.jsx — Visual step indicator for order status.
 *
 * Renders a horizontal timeline: Placed → Processing → Shipped → Delivered.
 * Supports cancelled orders with distinct red styling.
 *
 * @param {{ status: string }} props
 * @module components/OrderTimeline
 */
import React from "react";

const STEPS = ["placed", "shipped", "out_for_delivery", "delivered"];

const STEP_LABELS = {
    placed: "Placed",
    shipped: "Shipped",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
};

const STEP_ICONS = {
    placed: (
        <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
        </svg>
    ),
    shipped: (
        <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
        </svg>
    ),
    out_for_delivery: (
        <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
        </svg>
    ),
    delivered: (
        <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
    ),
};

export default function OrderTimeline({ status }) {
    const s = (status || "placed").toLowerCase();
    const isCancelled = s === "cancelled";
    // Map "processing" to "placed" since we no longer show Processing as a separate step
    const mappedStatus = s === "processing" ? "placed" : s;
    const currentIdx = STEPS.indexOf(mappedStatus);

    if (isCancelled) {
        return (
            <div className="flex items-center gap-2 py-3">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-red-100 border-2 border-red-300">
                    <svg className="h-3 w-3 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </div>
                <span className="text-xs font-semibold text-red-600">Order Cancelled</span>
            </div>
        );
    }

    return (
        <div className="w-full py-3">
            <div className="flex items-start">
                {STEPS.map((step, i) => {
                    const isDone = i < currentIdx;
                    const isCurrent = i === currentIdx;
                    return (
                        <React.Fragment key={step}>
                            {/* Step column: icon + label stacked */}
                            <div className="flex flex-col items-center shrink-0" style={{ width: "auto", minWidth: 0 }}>
                                <div
                                    className={[
                                        "flex items-center justify-center h-5 w-5 sm:h-7 sm:w-7 rounded-full border-2 shrink-0 transition-all duration-300 [&_svg]:h-2.5 [&_svg]:w-2.5 sm:[&_svg]:h-3.5 sm:[&_svg]:w-3.5",
                                        isDone
                                            ? "bg-emerald-500 border-emerald-500 text-white"
                                            : isCurrent
                                                ? "bg-[#1e3a5f] border-[#1e3a5f] text-white shadow-[0_0_0_3px_rgba(30,58,95,0.15)]"
                                                : "bg-stone-50 border-stone-200 text-stone-300",
                                    ].join(" ")}
                                >
                                    {isDone ? (
                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                    ) : STEP_ICONS[step]}
                                </div>
                                <span className={["mt-1.5 text-[8px] sm:text-[10px] font-semibold text-center leading-tight whitespace-nowrap", isDone ? "text-emerald-600" : isCurrent ? "text-[#1e3a5f]" : "text-stone-300"].join(" ")}>
                                    {STEP_LABELS[step]}
                                </span>
                            </div>
                            {/* Connector line between steps */}
                            {i < STEPS.length - 1 && (
                                <div className={["flex-1 h-0.5 mx-1 sm:mx-2 rounded-full transition-all duration-300 mt-2.5 sm:mt-3.5", i < currentIdx ? "bg-emerald-400" : "bg-stone-200"].join(" ")} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}

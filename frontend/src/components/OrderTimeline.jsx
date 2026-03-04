/**
 * OrderTimeline.jsx — Visual step indicator for order status.
 *
 * Renders a horizontal timeline: Placed → Processing → Shipped → Delivered.
 * Supports cancelled orders with distinct red styling.
 *
 * @param {{ status: string }} props
 * @module components/OrderTimeline
 */

const STEPS = ["placed", "processing", "shipped", "out_for_delivery", "delivered"];

const STEP_LABELS = {
    placed: "Placed",
    processing: "Processing",
    shipped: "Shipped",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
};

const STEP_ICONS = {
    placed: (
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
        </svg>
    ),
    processing: (
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
    ),
    shipped: (
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
        </svg>
    ),
    out_for_delivery: (
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
        </svg>
    ),
    delivered: (
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
    ),
};

export default function OrderTimeline({ status }) {
    const s = (status || "placed").toLowerCase();
    const isCancelled = s === "cancelled";
    const currentIdx = STEPS.indexOf(s);

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
        <div className="flex items-center w-full py-3">
            {STEPS.map((step, i) => {
                const isDone = i < currentIdx;
                const isCurrent = i === currentIdx;
                const isFuture = i > currentIdx;

                return (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                        {/* Step circle */}
                        <div className="flex flex-col items-center gap-1.5">
                            <div
                                className={[
                                    "flex items-center justify-center h-7 w-7 rounded-full border-2 transition-all duration-300",
                                    isDone
                                        ? "bg-emerald-500 border-emerald-500 text-white"
                                        : isCurrent
                                            ? "bg-[#1e3a5f] border-[#1e3a5f] text-white shadow-[0_0_0_3px_rgba(30,58,95,0.15)]"
                                            : "bg-stone-50 border-stone-200 text-stone-300",
                                ].join(" ")}
                            >
                                {isDone ? (
                                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    STEP_ICONS[step]
                                )}
                            </div>
                            <span
                                className={[
                                    "text-[10px] font-semibold whitespace-nowrap",
                                    isDone
                                        ? "text-emerald-600"
                                        : isCurrent
                                            ? "text-[#1e3a5f]"
                                            : "text-stone-300",
                                ].join(" ")}
                            >
                                {STEP_LABELS[step]}
                            </span>
                        </div>

                        {/* Connector line */}
                        {i < STEPS.length - 1 && (
                            <div className="flex-1 mx-2 mb-5">
                                <div
                                    className={[
                                        "h-0.5 w-full rounded-full transition-all duration-300",
                                        i < currentIdx
                                            ? "bg-emerald-400"
                                            : "bg-stone-200",
                                    ].join(" ")}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

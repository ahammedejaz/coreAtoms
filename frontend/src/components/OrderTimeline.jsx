/**
 * OrderTimeline.jsx — Visual step indicator for order status.
 *
 * Renders a horizontal 4-step timeline: Placed → Shipped → Out for delivery →
 * Delivered. Each step is a column (icon stacked above label) with connector
 * lines between them. Orders with "processing" status are mapped to the
 * "Placed" step. Cancelled orders get a distinct red treatment.
 *
 * @param {{ status: string }} props
 * @module components/OrderTimeline
 */
import React from "react";
import { Check, ClipboardList, MapPin, PackageCheck, Truck, X } from "lucide-react";

const STEPS = ["placed", "shipped", "out_for_delivery", "delivered"];

const STEP_LABELS = {
    placed: "Placed",
    shipped: "Shipped",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
};

const STEP_ICONS = {
    placed: ClipboardList,
    shipped: Truck,
    out_for_delivery: MapPin,
    delivered: PackageCheck,
};

export default function OrderTimeline({ status }) {
    const s = (status || "placed").toLowerCase();
    const isCancelled = s === "cancelled" || s === "payment_failed";
    const mappedStatus = (s === "processing" || s === "confirmed") ? "placed" : s;
    const currentIdx = STEPS.indexOf(mappedStatus);

    if (isCancelled) {
        return (
            <div className="flex items-center gap-2 py-3">
                <div className="grid h-6 w-6 place-items-center rounded-full bg-red-100 text-red-600">
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                </div>
                <span className="text-xs font-semibold text-red-700">Order cancelled</span>
            </div>
        );
    }

    return (
        <div className="w-full py-3">
            <ol className="flex items-start" aria-label="Order progress">
                {STEPS.map((step, i) => {
                    const isDone = i < currentIdx;
                    const isCurrent = i === currentIdx;
                    const Icon = isDone ? Check : STEP_ICONS[step];
                    return (
                        <React.Fragment key={step}>
                            <li className="flex shrink-0 flex-col items-center" aria-current={isCurrent ? "step" : undefined}>
                                <div
                                    className={[
                                        "grid h-6 w-6 place-items-center rounded-full border transition-colors duration-300 sm:h-8 sm:w-8",
                                        isDone
                                            ? "border-emerald-600 bg-emerald-600 text-white"
                                            : isCurrent
                                                ? "border-brand bg-brand text-white shadow-[0_0_0_4px_rgba(30,58,95,0.12)]"
                                                : "border-line-strong bg-white text-stone-300",
                                    ].join(" ")}
                                >
                                    <Icon className="h-3 w-3 sm:h-4 sm:w-4" strokeWidth={isDone ? 3 : 1.75} aria-hidden="true" />
                                </div>
                                <span className={["mt-1.5 whitespace-nowrap text-center text-[9px] font-semibold leading-tight sm:text-[11px]", isDone ? "text-emerald-700" : isCurrent ? "text-brand" : "text-stone-400"].join(" ")}>
                                    {STEP_LABELS[step]}
                                </span>
                            </li>
                            {i < STEPS.length - 1 && (
                                <li aria-hidden="true" className={["mx-1 mt-3 h-px flex-1 transition-colors duration-300 sm:mx-2 sm:mt-4", i < currentIdx ? "bg-emerald-500" : "bg-line-strong"].join(" ")} />
                            )}
                        </React.Fragment>
                    );
                })}
            </ol>
        </div>
    );
}

import { useEffect, useState } from "react";
import { supabase } from "../services/supabase/client";
import { useAuth } from "../context/AuthContext";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function MyOrders() {
    const { user } = useAuth();
    const userId = user?.id;

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [statusFilter, setStatusFilter] = useState("all");
    const [search, setSearch] = useState("");

    const load = async () => {
        if (!userId) return;
        setLoading(true);

        const { data, error } = await supabase
            .from("orders")
            .select(
                `
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
      `
            )
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error(error);
            setOrders([]);
        } else {
            setOrders(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

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

    const filteredOrders = (orders || []).filter((o) => {
        const s = String(o.status || "").toLowerCase();
        const okStatus = statusFilter === "all" ? true : s === statusFilter;

        const q = String(search || "").trim().toLowerCase();
        if (!q) return okStatus;

        const idText = String(o.id || "").toLowerCase();
        const createdText = o.created_at ? new Date(o.created_at).toLocaleString().toLowerCase() : "";
        const items = o.order_items || [];
        const itemText = items
            .map((it) => `${it.product_name || ""} ${it.product_id || ""}`)
            .join(" ")
            .toLowerCase();

        const okSearch = idText.includes(q) || createdText.includes(q) || itemText.includes(q);
        return okStatus && okSearch;
    });

    const statusOptions = [
        { value: "all", label: "All" },
        { value: "placed", label: "Placed" },
        { value: "processing", label: "Processing" },
        { value: "shipped", label: "Shipped" },
        { value: "delivered", label: "Delivered" },
        { value: "cancelled", label: "Cancelled" },
    ];

    return (
        <div className="mx-auto max-w-6xl px-4 py-10">
            <h2 className="text-2xl font-semibold tracking-tight">My Orders</h2>
            <p className="mt-1 text-sm text-neutral-500">Track your order status here.</p>

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
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
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
                        <button
                            onClick={() => {
                                setStatusFilter("all");
                                setSearch("");
                            }}
                            className="btn-ghost"
                            title="Clear filters"
                        >
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
                    const cancellable = ["placed", "processing"].includes(status.toLowerCase());

                    return (
                        <div key={o.id} className="card p-6">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm text-neutral-500">
                                        Order{" "}
                                        <span className="font-semibold text-neutral-950">
                      {String(o.id).slice(0, 8)}
                    </span>
                                    </div>

                                    <div className="mt-1 text-sm text-neutral-700">
                                        Total: <span className="font-semibold">{money(totalAmount)}</span> • Items:{" "}
                                        <span className="font-semibold">{totalCount}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span
                                      className={`px-3 py-1 rounded-full text-xs font-semibold
                                        ${
                                          status.toLowerCase() === "placed"
                                            ? "bg-green-100 text-green-700"
                                            : status.toLowerCase() === "processing"
                                            ? "bg-yellow-100 text-yellow-700"
                                            : status.toLowerCase() === "shipped"
                                            ? "bg-blue-100 text-blue-700"
                                            : status.toLowerCase() === "delivered"
                                            ? "bg-emerald-100 text-emerald-700"
                                            : status.toLowerCase() === "cancelled"
                                            ? "bg-red-100 text-red-700"
                                            : "bg-neutral-100 text-neutral-700"
                                        }`}
                                    >
                                      {status}
                                    </span>

                                    {cancellable && (
                                        <button
                                            onClick={() => onCancel(o.id, status)}
                                            className="btn-ghost"
                                            title="Cancel before shipment"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 border-t border-neutral-200 pt-4 space-y-3">
                                {items.map((it) => (
                                    <div key={it.id} className="flex items-center justify-between gap-3">
                                        <div className="min-w-0 flex items-center gap-3">
                                            {it.image_url ? (
                                                <img
                                                    src={it.image_url}
                                                    alt={it.product_name || "Product"}
                                                    className="h-12 w-12 rounded-xl object-cover border border-neutral-200"
                                                />
                                            ) : null}

                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-neutral-950">
                                                    {it.product_name || "Product"} × {it.qty}
                                                </div>
                                                <div className="text-xs text-neutral-500">{money(it.unit_price_inr)} each</div>
                                            </div>
                                        </div>

                                        <div className="text-sm font-semibold text-neutral-950">
                                            {money(it.line_total_inr)}
                                        </div>
                                    </div>
                                ))}

                                <div className="pt-2 text-xs text-neutral-500">
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
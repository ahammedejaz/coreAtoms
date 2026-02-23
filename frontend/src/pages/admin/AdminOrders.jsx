import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase/client";

const LOW_STOCK_THRESHOLD = 5;

export default function AdminOrders({ onOrdersChange }) {
    const [orders, setOrders]                   = useState([]);
    const [loadingOrders, setLoadingOrders]     = useState(false);
    const [orderErr, setOrderErr]               = useState("");
    const [orderSearch, setOrderSearch]         = useState("");
    const [orderStatusFilter, setOrderStatusFilter] = useState("All");
    const [orderDateFrom, setOrderDateFrom]     = useState("");
    const [orderDateTo, setOrderDateTo]         = useState("");
    const [expandedOrderIds, setExpandedOrderIds] = useState(new Set());

    const toggleOrderExpanded = (orderId) => {
        setExpandedOrderIds((prev) => {
            const next = new Set(prev);
            if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
            return next;
        });
    };

const STATUS_OPTIONS = ["placed", "processing", "shipped", "delivered", "cancelled"];

    const STATUS_LABELS = {
        placed: "Placed",
        processing: "Processing",
        shipped: "Shipped",
        delivered: "Delivered",
        cancelled: "Cancelled",
    };

    const STATUS_BADGE = {
        placed: "bg-green-50 text-green-700",
        processing: "bg-yellow-50 text-yellow-700",
        shipped: "bg-blue-50 text-blue-700",
        delivered: "bg-emerald-50 text-emerald-700",
        cancelled: "bg-red-50 text-red-700",
    };

    const updateOrderStatus = async (orderId, newStatus) => {
        const order = orders.find((o) => o.id === orderId);
        const currentStatus = String(order?.status || "").toLowerCase();
        if (currentStatus === newStatus) return;

        const ok = window.confirm(
            `Change order status from "${STATUS_LABELS[currentStatus] || currentStatus}" → "${STATUS_LABELS[newStatus] || newStatus}"?`
        );
        if (!ok) return;

        const { error } = await supabase
            .from("orders")
            .update({ status: newStatus })
            .eq("id", orderId);
        if (error) {
            alert(error.message);
            return;
        }
        load();
    };

    const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
    const [bulkStatus, setBulkStatus]             = useState("");
    const [applyingBulk, setApplyingBulk]         = useState(false);

    const toggleSelectOrder = (id) => {
        setSelectedOrderIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedOrderIds.size === filteredOrders.length) {
            setSelectedOrderIds(new Set());
        } else {
            setSelectedOrderIds(new Set(filteredOrders.map((o) => o.id)));
        }
    };

    const applyBulkStatus = async () => {
        if (!bulkStatus || selectedOrderIds.size === 0) return;
        const ok = window.confirm(`Set ${selectedOrderIds.size} order(s) to "${STATUS_LABELS[bulkStatus] || bulkStatus}"?`);
        if (!ok) return;
        setApplyingBulk(true);
        const ids = Array.from(selectedOrderIds);
        const { error } = await supabase.from("orders").update({ status: bulkStatus }).in("id", ids);
        setApplyingBulk(false);
        if (error) { alert(error.message); return; }
        setSelectedOrderIds(new Set());
        setBulkStatus("");
        load();
    };

const load = async () => {
        setLoadingOrders(true);
        setOrderErr("");

        let data = [];
        let queryError = null;

        try {
            const res = await supabase
                .from("orders")
                .select(
                    `
          id,
          user_id,
          status,
          created_at,
          total_amount_inr,
          total_inr,
          total_items,
          shipping_address,
          profiles (
            id,
            email,
            full_name
          ),
          order_items (
            product_id,
            qty,
            unit_price_inr,
            line_total_inr,
            variant_label,
            products (
              name
            )
          )
        `
                )
                .order("created_at", { ascending: false });

            data = res?.data || [];
            queryError = res?.error || null;

            if (queryError) throw new Error(queryError.message);

            // Fallback profiles fetch
            const userIds = Array.from(
                new Set((data || []).map((o) => o?.user_id).filter(Boolean))
            );

            let profileMap = {};
            if (userIds.length) {
                const profRes = await supabase
                    .from("profiles")
                    .select("id,email,full_name")
                    .in("id", userIds);

                if (!profRes?.error) {
                    (profRes?.data || []).forEach((p) => {
                        profileMap[p.id] = {
                            email: String(p?.email || "").trim(),
                            full_name: String(p?.full_name || "").trim(),
                        };
                    });
                }
            }

            const enriched = (data || []).map((o) => {
                const prof = Array.isArray(o?.profiles) ? o.profiles[0] : o?.profiles;

                const joinEmail = String(prof?.email || "").trim();
                const joinName = String(prof?.full_name || "").trim();

                const fallback = profileMap?.[o?.user_id] || null;
                const fallbackEmail = String(fallback?.email || "").trim();
                const fallbackName = String(fallback?.full_name || "").trim();

                const ship = o?.shipping_address || {};
                const shipEmail = String(
                    ship?.email || ship?.Email || ship?.userEmail || ship?.user_email || ""
                ).trim();

                const profileEmail = joinEmail || fallbackEmail || shipEmail || "";
                const profileName = joinName || fallbackName || "";

                const shipping_name = String(ship?.fullName || ship?.name || "").trim();
                const shipping_phone = String(ship?.phone || ship?.mobile || "").trim();
                const shipping_address_1 = String(ship?.line1 || ship?.address1 || "").trim();
                const shipping_address_2 = String(ship?.line2 || ship?.address2 || "").trim();
                const shipping_city = String(ship?.city || "").trim();
                const shipping_state = String(ship?.state || "").trim();
                const shipping_pincode = String(ship?.pincode || ship?.zip || "").trim();
                const shipping_country = String(ship?.country || "India").trim();

                const dbTotal = Number(o?.total_amount_inr ?? o?.total_inr ?? 0);
                let computed_total_inr =
                    Number.isFinite(dbTotal) && dbTotal > 0 ? dbTotal : 0;

                const items = Array.isArray(o?.order_items) ? o.order_items : [];
                const detailedItems = items.map((it) => {
                    const qtyNum = Number(it?.qty || 0);
                    const unitNum = Number(it?.unit_price_inr || 0);
                    const lineNum = Number(it?.line_total_inr ?? qtyNum * unitNum);

                    return {
                        product_id: it?.product_id,
                        product_name: it?.products?.name || "",
                        variant_label: it?.variant_label || "",
                        qty: it?.qty,
                        qty_num: Number.isFinite(qtyNum) ? qtyNum : 0,
                        unit_price_inr: it?.unit_price_inr,
                        line_total_inr: it?.line_total_inr,
                        line_total_num: Number.isFinite(lineNum) ? lineNum : 0,
                    };
                });

                if (!computed_total_inr) {
                    computed_total_inr = detailedItems.reduce(
                        (sum, it) => sum + (it.line_total_num || 0),
                        0
                    );
                }

                return {
                    ...o,
                    user_email: profileEmail,
                    user_full_name: profileName,
                    shipping_name: shipping_name || profileName || "",
                    shipping_email: profileEmail || "",
                    shipping_phone,
                    shipping_address_1,
                    shipping_address_2,
                    shipping_city,
                    shipping_state,
                    shipping_pincode,
                    shipping_country,
                    computed_total_inr,
                    order_items_detailed: detailedItems,
                };
            });

            setOrders(enriched); onOrdersChange?.(enriched);
        } catch (e) {
            setOrderErr(e?.message || "Failed to load orders");
            setOrders([]);
        } finally {
            setLoadingOrders(false);
        }
    };

    useEffect(() => { load(); }, []); // eslint-disable-line

const filteredOrders = useMemo(() => {
        let list = orders || [];

        const q = String(orderSearch || "").trim().toLowerCase();
        if (q) {
            list = list.filter((o) => {
                const idStr = String(o?.id ?? "").toLowerCase();
                const userStr = String(o?.user_id ?? "").toLowerCase();
                const emailStr = String(o?.user_email ?? "").toLowerCase();
                const nameStr = String(o?.shipping_name ?? "").toLowerCase();
                return (
                    idStr.includes(q) ||
                    userStr.includes(q) ||
                    emailStr.includes(q) ||
                    nameStr.includes(q)
                );
            });
        }

        if (orderStatusFilter && orderStatusFilter !== "All") {
            const wanted = String(orderStatusFilter || "").trim().toLowerCase();
            list = list.filter(
                (o) => String(o?.status || "").trim().toLowerCase() === wanted
            );
        }

        const from = orderDateFrom
            ? new Date(`${orderDateFrom}T00:00:00`).getTime()
            : null;
        const to = orderDateTo
            ? new Date(`${orderDateTo}T23:59:59`).getTime()
            : null;

        if (from || to) {
            list = list.filter((o) => {
                const t = o?.created_at ? new Date(o.created_at).getTime() : null;
                if (!t) return false;
                if (from && t < from) return false;
                if (to && t > to) return false;
                return true;
            });
        }

        return list;
    }, [orders, orderSearch, orderStatusFilter, orderDateFrom, orderDateTo]);

// -------------------- CSV Export --------------------
    const exportOrdersCSV = () => {
        const rows = filteredOrders;
        if (rows.length === 0) return;

        const headers = [
            "Order ID", "Date", "Status", "Customer Name", "Customer Email",
            "Phone", "Address", "City", "State", "Pincode",
            "Items", "Total (INR)"
        ];

        const escape = (val) => {
            const s = String(val ?? "").replace(/"/g, '""');
            return `"${s}"`;
        };

        const csvRows = rows.map((o) => {
            const itemsSummary = (o.order_items_detailed || [])
                .map((it) => `${it.product_name} x${it.qty_num}`)
                .join("; ");
            const address = [o.shipping_address_1, o.shipping_address_2]
                .filter(Boolean).join(", ");

            return [
                o.id,
                o.created_at ? new Date(o.created_at).toLocaleString() : "",
                o.status || "",
                o.shipping_name || o.user_full_name || "",
                o.user_email || "",
                o.shipping_phone || "",
                address,
                o.shipping_city || "",
                o.shipping_state || "",
                o.shipping_pincode || "",
                itemsSummary,
                o.computed_total_inr ?? 0,
            ].map(escape).join(",");
        });

        const csv = [headers.map(escape).join(","), ...csvRows].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const dateStr = new Date().toISOString().slice(0, 10);
        a.download = `coreatoms-orders-${dateStr}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
                        <div className="rounded-2xl border border-[#E8E4DE] bg-white p-5">
                            <div className="text-base font-semibold text-stone-900">Orders</div>

                            <div className="mt-4">
                                <div className="text-sm font-semibold text-stone-900">
                                    Orders Management
                                </div>

                                {/* Filter Bar */}
                                <div className="mt-3 grid gap-3 md:grid-cols-4">
                                    <div>
                                        <div className="text-xs text-stone-400">
                                            Search (Order ID / User)
                                        </div>
                                        <input
                                            value={orderSearch}
                                            onChange={(e) => setOrderSearch(e.target.value)}
                                            placeholder="Search by order id, user id, name, or email..."
                                            className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <div className="text-xs text-stone-400">Status</div>
                                        <select
                                            value={orderStatusFilter}
                                            onChange={(e) => setOrderStatusFilter(e.target.value)}
                                            className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                        >
                                            <option value="All">All</option>
                                            <option value="placed">Placed</option>
                                            <option value="processing">Processing</option>
                                            <option value="shipped">Shipped</option>
                                            <option value="delivered">Delivered</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    </div>

                                    <div>
                                        <div className="text-xs text-stone-400">From</div>
                                        <input
                                            type="date"
                                            value={orderDateFrom}
                                            onChange={(e) => setOrderDateFrom(e.target.value)}
                                            className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <div className="text-xs text-stone-400">To</div>
                                        <input
                                            type="date"
                                            value={orderDateTo}
                                            onChange={(e) => setOrderDateTo(e.target.value)}
                                            className="mt-1 w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-xs text-stone-400">
                                        Showing{" "}
                                        <span className="font-semibold text-stone-900">{filteredOrders.length}</span>{" "}
                                        of {orders.length}
                                        {selectedOrderIds.size > 0 && (
                                            <span className="ml-2 font-semibold text-stone-900">
                                                • {selectedOrderIds.size} selected
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {/* Bulk status update */}
                                        {selectedOrderIds.size > 0 && (
                                            <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5">
                                                <span className="text-xs font-semibold text-blue-700">
                                                    {selectedOrderIds.size} selected
                                                </span>
                                                <select
                                                    value={bulkStatus}
                                                    onChange={(e) => setBulkStatus(e.target.value)}
                                                    className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs text-stone-900 outline-none"
                                                >
                                                    <option value="">Set status…</option>
                                                    {STATUS_OPTIONS.map((s) => (
                                                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={applyBulkStatus}
                                                    disabled={!bulkStatus || applyingBulk}
                                                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                                                >
                                                    {applyingBulk ? "Applying…" : "Apply"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setSelectedOrderIds(new Set()); setBulkStatus(""); }}
                                                    className="text-xs text-blue-600 hover:text-blue-800"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}

                                        {/* Export CSV */}
                                        <button
                                            type="button"
                                            onClick={exportOrdersCSV}
                                            disabled={filteredOrders.length === 0}
                                            className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs font-semibold text-stone-900 hover:bg-stone-50 disabled:opacity-40 flex items-center gap-1.5"
                                        >
                                            ↓ Export CSV
                                            {filteredOrders.length > 0 && (
                                                <span className="text-stone-400">({filteredOrders.length})</span>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOrderSearch("");
                                                setOrderStatusFilter("All");
                                                setOrderDateFrom("");
                                                setOrderDateTo("");
                                                setSelectedOrderIds(new Set());
                                                setBulkStatus("");
                                            }}
                                            className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs font-semibold text-stone-900 hover:bg-stone-50"
                                        >
                                            Clear filters
                                        </button>
                                    </div>
                                </div>

                                {orderErr && <div className="mt-3 text-sm text-red-600">{orderErr}</div>}

                                {loadingOrders ? (
                                    <div className="mt-4 text-sm text-stone-400">Loading orders...</div>
                                ) : filteredOrders.length === 0 ? (
                                    <div className="mt-4 text-sm text-stone-400">No orders yet.</div>
                                ) : (
                                    <div className="mt-3">
                                        {/* Mobile cards */}
                                        <div className="grid gap-3 md:hidden">
                                            {filteredOrders.map((o) => {
                                                const st = String(o.status || "").trim().toLowerCase();

                                                const badge = [
                                                    "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold",
                                                    st === "placed" && "bg-green-50 text-green-700",
                                                    st === "processing" && "bg-yellow-50 text-yellow-700",
                                                    st === "shipped" && "bg-purple-50 text-purple-700",
                                                    st === "delivered" && "bg-green-50 text-green-700",
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ");

                                                const displayName = o.user_full_name || o.shipping_name || "";
                                                const displayEmail = o.user_email || "";
                                                const customerLine =
                                                    displayName && displayEmail
                                                        ? `${displayName} (${displayEmail})`
                                                        : displayName
                                                            ? displayName
                                                            : displayEmail
                                                                ? displayEmail
                                                                : o.user_id;

                                                const isOpen = expandedOrderIds.has(o.id);

                                                return (
                                                    <div key={o.id} className={["rounded-2xl border p-4", selectedOrderIds.has(o.id) ? "border-blue-300 bg-blue-50/50" : "border-[#E8E4DE] bg-white"].join(" ")}>
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-start gap-2 min-w-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedOrderIds.has(o.id)}
                                                                    onChange={() => toggleSelectOrder(o.id)}
                                                                    className="mt-0.5 h-4 w-4 rounded shrink-0"
                                                                />
                                                                <div className="min-w-0">
                                                                    <div className="text-sm font-semibold text-stone-900">#{o.id}</div>
                                                                    <div className="mt-1 text-xs text-stone-500 truncate">{customerLine}</div>
                                                                    <div className="mt-2 text-sm font-semibold text-stone-900">
                                                                        ₹{Number(o.computed_total_inr ?? 0).toLocaleString("en-IN")}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="shrink-0 flex flex-col items-end gap-2">
                                                                <span className={badge}>{st || "—"}</span>
                                                                <div className="text-[11px] text-stone-400">
                                                                    {o.created_at ? new Date(o.created_at).toLocaleString() : "—"}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                                            <select
                                                                value={st}
                                                                onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                                                                className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs"
                                                            >
                                                                <option value="placed">Placed</option>
                                                                <option value="processing">Processing</option>
                                                                <option value="shipped">Shipped</option>
                                                                <option value="delivered">Delivered</option>
                                                                <option value="cancelled">Cancelled</option>
                                                            </select>

                                                            <button
                                                                type="button"
                                                                onClick={() => toggleOrderExpanded(o.id)}
                                                                className="w-full rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs font-semibold text-stone-900 hover:bg-stone-50"
                                                            >
                                                                {isOpen ? "Hide details" : "View details"}
                                                            </button>
                                                        </div>

                                                        {isOpen && (
                                                            <div className="mt-3 rounded-2xl border border-[#E8E4DE] bg-stone-50/50 p-3">
                                                                <div className="grid gap-3">
                                                                    <div className="rounded-xl border border-[#E8E4DE] bg-white p-3">
                                                                        <div className="text-xs font-semibold text-stone-400">Customer</div>
                                                                        <div className="mt-2 text-sm text-stone-900">
                                                                            <div className="font-semibold">
                                                                                {o.shipping_name || o.user_full_name || "(No name)"}
                                                                            </div>
                                                                            <div className="mt-1 text-xs text-stone-500">
                                                                                Email: {o.user_email || "(No email)"}
                                                                            </div>
                                                                            <div className="mt-1 text-xs text-stone-500">
                                                                                Phone: {o.shipping_phone || "(No phone)"}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="rounded-xl border border-[#E8E4DE] bg-white p-3">
                                                                        <div className="text-xs font-semibold text-stone-400">Shipping Address</div>
                                                                        <div className="mt-2 text-xs text-stone-600 leading-relaxed">
                                                                            {[
                                                                                o.shipping_address_1,
                                                                                o.shipping_address_2,
                                                                                [o.shipping_city, o.shipping_state].filter(Boolean).join(", "),
                                                                                o.shipping_pincode,
                                                                                o.shipping_country,
                                                                            ]
                                                                                .filter(Boolean)
                                                                                .map((line, idx) => (
                                                                                    <div key={idx}>{line}</div>
                                                                                ))}
                                                                        </div>
                                                                    </div>

                                                                    <div className="rounded-xl border border-[#E8E4DE] bg-white p-3">
                                                                        <div className="text-xs font-semibold text-stone-400">Items</div>
                                                                        <div className="mt-2 space-y-2">
                                                                            {(o.order_items_detailed || []).length === 0 ? (
                                                                                <div className="text-xs text-stone-500">
                                                                                    No items found for this order.
                                                                                </div>
                                                                            ) : (
                                                                                (o.order_items_detailed || []).map((it, idx) => (
                                                                                    <div
                                                                                        key={it.product_id || idx}
                                                                                        className="flex items-start justify-between gap-3 text-xs"
                                                                                    >
                                                                                        <div className="min-w-0">
                                                                                            <div className="font-semibold text-stone-900 truncate">
                                                                                                {it.product_name || `Product #${it.product_id}`}
                                                                                            </div>
                                                                                            {it.variant_label && (
                                                                                                <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-[#EFF6FF] border border-[#1e3a5f]/15 px-2 py-0.5 text-[10px] font-medium text-[#1e3a5f]">
                                                                                                    <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg>
                                                                                                    {it.variant_label}
                                                                                                </span>
                                                                                            )}
                                                                                            <div className="text-stone-500 mt-0.5">
                                                                                                Qty: {Number(it.qty_num || 0)}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="shrink-0 text-stone-900 font-semibold">
                                                                                            ₹{Number(it.line_total_num || 0).toLocaleString("en-IN")}
                                                                                        </div>
                                                                                    </div>
                                                                                ))
                                                                            )}

                                                                            <div className="pt-2 mt-2 border-t border-[#E8E4DE] flex items-center justify-between text-xs">
                                                                                <div className="text-stone-500">Order Total</div>
                                                                                <div className="font-semibold text-stone-900">
                                                                                    ₹{Number(o.computed_total_inr ?? 0).toLocaleString("en-IN")}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Desktop table */}
                                        <div className="hidden md:block overflow-x-auto">
                                            <table className="w-full table-fixed text-sm">
                                                <thead>
                                                <tr className="text-left text-stone-400 border-b">
                                                    <th className="py-2 pr-2 w-[4%]">
                                                        <input
                                                            type="checkbox"
                                                            checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length}
                                                            onChange={toggleSelectAll}
                                                            className="h-4 w-4 rounded"
                                                        />
                                                    </th>
                                                    <th className="py-2 pr-4 w-[16%]">Order ID</th>
                                                    <th className="py-2 pr-4 w-[26%]">Customer</th>
                                                    <th className="py-2 pr-4 w-[11%]">Total</th>
                                                    <th className="py-2 pr-4 w-[11%]">Status</th>
                                                    <th className="py-2 pr-4 w-[16%]">Created</th>
                                                    <th className="py-2 w-[12%]">Actions</th>
                                                </tr>
                                                </thead>

                                                <tbody>
                                                {filteredOrders.map((o) => {
                                                    const st = String(o.status || "").trim().toLowerCase();

                                                    const badge = [
                                                        "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold",
                                                        st === "placed" && "bg-green-50 text-green-700",
                                                        st === "processing" && "bg-yellow-50 text-yellow-700",
                                                        st === "shipped" && "bg-purple-50 text-purple-700",
                                                        st === "delivered" && "bg-green-50 text-green-700",
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" ");

                                                    const displayName = o.user_full_name || o.shipping_name || "";
                                                    const displayEmail = o.user_email || "";
                                                    const customerCell =
                                                        displayName && displayEmail
                                                            ? `${displayName} (${displayEmail})`
                                                            : displayName
                                                                ? displayName
                                                                : displayEmail
                                                                    ? displayEmail
                                                                    : o.user_id;

                                                    return (
                                                        <Fragment key={o.id}>
                                                            <tr className={["border-b align-top", selectedOrderIds.has(o.id) ? "bg-blue-50/60" : ""].join(" ")}>
                                                                <td className="py-2 pr-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedOrderIds.has(o.id)}
                                                                        onChange={() => toggleSelectOrder(o.id)}
                                                                        className="h-4 w-4 rounded"
                                                                    />
                                                                </td>
                                                                <td className="py-2 pr-4 text-xs font-semibold text-stone-900 break-all">
                                                                    #{o.id}
                                                                </td>

                                                                <td className="py-2 pr-4 text-xs text-stone-500 break-all">
                                                                    {customerCell}
                                                                </td>

                                                                <td className="py-2 pr-4">
                                                                    ₹{Number(o.computed_total_inr ?? 0).toLocaleString("en-IN")}
                                                                </td>

                                                                <td className="py-2 pr-4">
                                                                    <span className={badge}>{st || "—"}</span>
                                                                </td>

                                                                <td className="py-2 pr-4 text-xs text-stone-400">
                                                                    {o.created_at ? new Date(o.created_at).toLocaleString() : "—"}
                                                                </td>

                                                                <td className="py-2">
                                                                    <div className="flex flex-col gap-2">
                                                                        <select
                                                                            value={st}
                                                                            onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                                                                            className="w-full rounded-lg border border-[#E8E4DE] bg-white px-2 py-1.5 text-xs"
                                                                        >
                                                                            <option value="placed">Placed</option>
                                                                            <option value="processing">Processing</option>
                                                                            <option value="shipped">Shipped</option>
                                                                            <option value="delivered">Delivered</option>
                                                                            <option value="cancelled">Cancelled</option>
                                                                        </select>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleOrderExpanded(o.id)}
                                                                            className="w-full rounded-lg border border-[#E8E4DE] bg-white px-2 py-1.5 text-xs font-semibold text-stone-900 hover:bg-stone-50"
                                                                        >
                                                                            {expandedOrderIds.has(o.id) ? "Hide details" : "View details"}
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>

                                                            {expandedOrderIds.has(o.id) && (
                                                                <tr className="border-b bg-stone-50/50">
                                                                    <td colSpan={6} className="py-3 px-2">
                                                                        <div className="grid gap-4 md:grid-cols-3">
                                                                            {/* Customer */}
                                                                            <div className="rounded-xl border border-[#E8E4DE] bg-white p-4">
                                                                                <div className="text-xs font-semibold text-stone-400">Customer</div>
                                                                                <div className="mt-2 text-sm text-stone-900">
                                                                                    <div className="font-semibold">
                                                                                        {o.shipping_name || o.user_full_name || "(No name)"}
                                                                                    </div>
                                                                                    <div className="mt-1 text-xs text-stone-500">
                                                                                        Email: {o.user_email || "(No email)"}
                                                                                    </div>
                                                                                    <div className="mt-1 text-xs text-stone-500">
                                                                                        Phone: {o.shipping_phone || "(No phone)"}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Address */}
                                                                            <div className="rounded-xl border border-[#E8E4DE] bg-white p-4">
                                                                                <div className="text-xs font-semibold text-stone-400">Shipping Address</div>
                                                                                <div className="mt-2 text-sm text-stone-900">
                                                                                    <div className="text-xs text-stone-600 leading-relaxed">
                                                                                        {[
                                                                                            o.shipping_address_1,
                                                                                            o.shipping_address_2,
                                                                                            [o.shipping_city, o.shipping_state].filter(Boolean).join(", "),
                                                                                            o.shipping_pincode,
                                                                                            o.shipping_country,
                                                                                        ]
                                                                                            .filter(Boolean)
                                                                                            .map((line, idx) => (
                                                                                                <div key={idx}>{line}</div>
                                                                                            ))}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Items */}
                                                                            <div className="rounded-xl border border-[#E8E4DE] bg-white p-4">
                                                                                <div className="text-xs font-semibold text-stone-400">Items</div>
                                                                                <div className="mt-2 space-y-2">
                                                                                    {(o.order_items_detailed || []).length === 0 ? (
                                                                                        <div className="text-xs text-stone-500">
                                                                                            No items found for this order.
                                                                                        </div>
                                                                                    ) : (
                                                                                        (o.order_items_detailed || []).map((it, idx) => (
                                                                                            <div
                                                                                                key={it.product_id || idx}
                                                                                                className="flex items-start justify-between gap-3 text-xs"
                                                                                            >
                                                                                <div className="min-w-0">
                                                                                    <div className="font-semibold text-stone-900 truncate">
                                                                                        {it.product_name || `Product #${it.product_id}`}
                                                                                    </div>
                                                                                    {it.variant_label && (
                                                                                        <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-[#EFF6FF] border border-[#1e3a5f]/15 px-2 py-0.5 text-[10px] font-medium text-[#1e3a5f]">
                                                                                            <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg>
                                                                                            {it.variant_label}
                                                                                        </span>
                                                                                    )}
                                                                                    <div className="text-stone-500 mt-0.5">
                                                                                        Qty: {Number(it.qty_num || 0)}
                                                                                    </div>
                                                                                </div>
                                                                                                <div className="shrink-0 text-stone-900 font-semibold">
                                                                                                    ₹{Number(it.line_total_num || 0).toLocaleString("en-IN")}
                                                                                                </div>
                                                                                            </div>
                                                                                        ))
                                                                                    )}

                                                                                    <div className="pt-2 mt-2 border-t border-[#E8E4DE] flex items-center justify-between text-xs">
                                                                                        <div className="text-stone-500">Order Total</div>
                                                                                        <div className="font-semibold text-stone-900">
                                                                                            ₹{Number(o.computed_total_inr ?? 0).toLocaleString("en-IN")}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Fragment>
                                                    );
                                                })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
    );
}

/**
 * AdminDashboard.jsx — Shell only.
 * Tab components are always mounted but hidden with CSS so their state and
 * data survives tab switches. This prevents the Homepage editor from losing
 * unsaved changes when you click away, and lets Reviews load its count on
 * app start without needing a tab visit.
 */
import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import AdminProducts from "./admin/AdminProducts.jsx";
import AdminOrders   from "./admin/AdminOrders.jsx";
import AdminHomepage from "./admin/AdminHomepage.jsx";
import AdminReviews  from "./admin/AdminReviews.jsx";
import AdminSettings from "./admin/AdminSettings.jsx";

const LOW_STOCK_THRESHOLD = 5;

export default function AdminDashboard() {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState("products");

    // Sub-components report their data up via callbacks so the stats bar stays current
    const [products, setProducts]       = useState([]);
    const [orders, setOrders]           = useState([]);
    const [reviewCount, setReviewCount] = useState(0);

    const stats = useMemo(() => {
        const totalOrders    = orders.length;
        const totalRevenue   = orders.reduce((s, o) => s + Number(o.computed_total_inr || 0), 0);
        const activeProducts = products.filter((p) => p.is_active).length;
        const lowStock       = products.filter(
            (p) => p.is_active && Number(p.stock_qty || 0) <= LOW_STOCK_THRESHOLD
        ).length;
        const pendingOrders  = orders.filter(
            (o) => ["placed", "processing"].includes(String(o.status || "").toLowerCase())
        ).length;
        return { totalOrders, totalRevenue, activeProducts, lowStock, pendingOrders };
    }, [orders, products]);

    if (!profile || profile.role !== "admin") {
        return (
            <div className="mx-auto max-w-6xl px-4 py-20 text-center">
                <div className="text-lg font-semibold text-stone-900">Access denied</div>
                <div className="mt-2 text-sm text-stone-500">You must be an admin to view this page.</div>
            </div>
        );
    }

    const tab = (id, label, badge, badgeStyle) => (
        <button
            type="button"
            onClick={() => setActiveTab(id)}
            className={[
                "shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition flex items-center gap-2",
                activeTab === id
                    ? "border-stone-300 bg-[#1e3a5f] text-white shadow-sm"
                    : "border-[#E8E4DE] bg-white text-stone-900 hover:bg-stone-50",
            ].join(" ")}
        >
            {label}
            {badge > 0 && (
                <span className={[
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold",
                    activeTab === id
                        ? "bg-white text-stone-900"
                        : (badgeStyle || "bg-red-500 text-white"),
                ].join(" ")}>
                    {badge}
                </span>
            )}
        </button>
    );

    // Helper: show/hide a tab panel without unmounting it
    const panel = (id) => ({ className: activeTab === id ? "" : "hidden" });

    return (
        <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="card p-6">

                {/* ── Header ── */}
                <div className="text-xs text-stone-400">Admin</div>
                <div className="mt-1 text-2xl font-semibold text-stone-900">Dashboard</div>
                <div className="mt-2 text-sm text-stone-500">
                    Logged in as <span className="font-semibold">{profile?.email}</span> ·{" "}
                    role: <span className="font-semibold">{profile?.role}</span>
                </div>

                {/* ── Stats Row ── */}
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                    <StatCard label="Total Orders"    value={stats.totalOrders} />
                    <StatCard label="Total Revenue"   value={`₹${stats.totalRevenue.toLocaleString("en-IN")}`} />
                    <StatCard label="Active Products" value={stats.activeProducts} />
                    <StatCard
                        label={`Low Stock${stats.lowStock > 0 ? " ⚠️" : ""}`}
                        value={stats.lowStock}
                        sub={stats.lowStock > 0 ? `≤${LOW_STOCK_THRESHOLD} units` : null}
                        warn={stats.lowStock > 0} warnColor="amber"
                    />
                    <StatCard
                        label={`Pending${stats.pendingOrders > 0 ? " 🔔" : ""}`}
                        value={stats.pendingOrders}
                        sub={stats.pendingOrders > 0 ? "Need action" : null}
                        warn={stats.pendingOrders > 0} warnColor="blue"
                    />
                </div>

                {/* ── Tab Bar ── */}
                <div className="mt-6 -mx-4 px-4 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
                    {tab("products", "Products")}
                    {tab("orders",   "Orders",  stats.pendingOrders)}
                    {tab("settings", "Settings")}
                    {tab("reviews",  "Reviews", reviewCount, "bg-neutral-200 text-stone-600")}
                    <button
                        type="button"
                        onClick={() => setActiveTab("homepage")}
                        className={[
                            "shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition flex items-center gap-2",
                            activeTab === "homepage"
                                ? "border-stone-300 bg-[#1e3a5f] text-white shadow-sm"
                                : "border-[#E8E4DE] bg-white text-stone-900 hover:bg-stone-50",
                        ].join(" ")}
                    >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
                        </svg>
                        Homepage
                    </button>
                    <div className="hidden md:block ml-auto text-xs text-stone-400">
                        {activeTab === "products" && `${products.length} products`}
                        {activeTab === "orders"   && `${orders.length} orders`}
                        {activeTab === "reviews"  && `${reviewCount} reviews`}
                        {activeTab === "settings" && "App settings"}
                        {activeTab === "homepage" && "Homepage editor"}
                    </div>
                </div>

                {/* ── Tab Panels — always mounted, hidden via CSS ── */}
                <div className="mt-6">
                    <div {...panel("products")}><AdminProducts onProductsChange={setProducts} /></div>
                    <div {...panel("orders")}  ><AdminOrders   onOrdersChange={setOrders} /></div>
                    <div {...panel("settings")}><AdminSettings /></div>
                    {/*
                      Reviews and Homepage are always rendered (never conditionally removed)
                      so Reviews fires onCountChange on mount, and Homepage keeps its
                      unsaved form state while you switch to another tab.
                    */}
                    <div {...panel("reviews")} ><AdminReviews  onCountChange={setReviewCount} /></div>
                    <div {...panel("homepage")}><AdminHomepage products={products} /></div>
                </div>

            </div>
        </div>
    );
}

function StatCard({ label, value, sub, warn, warnColor }) {
    const palette = {
        amber: { wrap: "border-amber-200 bg-amber-50", lbl: "text-amber-600", val: "text-amber-700", sub: "text-amber-600" },
        blue:  { wrap: "border-blue-200 bg-blue-50",   lbl: "text-blue-600",  val: "text-blue-700",  sub: "text-blue-600"  },
    };
    const p = warn && warnColor ? palette[warnColor] : null;
    return (
        <div className={["rounded-2xl border p-4 shadow-sm", p ? p.wrap : "border-[#E8E4DE] bg-white"].join(" ")}>
            <div className={["text-xs", p ? p.lbl : "text-stone-400"].join(" ")}>{label}</div>
            <div className={["mt-1 text-2xl font-semibold", p ? p.val : "text-stone-900"].join(" ")}>{value}</div>
            {sub && <div className={["mt-1 text-xs", p ? p.sub : "text-stone-400"].join(" ")}>{sub}</div>}
        </div>
    );
}

/**
 * AdminDashboard.jsx — Shell only.
 * Tab components are always mounted but hidden with CSS so their state and
 * data survives tab switches. This prevents the Homepage editor from losing
 * unsaved changes when you click away, and lets Reviews load its count on
 * app start without needing a tab visit.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AdminProducts from "./admin/AdminProducts.jsx";
import AdminOrders from "./admin/AdminOrders.jsx";
import AdminHomepage from "./admin/AdminHomepage.jsx";
import AdminReviews from "./admin/AdminReviews.jsx";
import AdminSettings from "./admin/AdminSettings.jsx";

const LOW_STOCK_THRESHOLD = 5;

/* ── Tab icon SVGs (20×20 heroicons mini) ─────────────────────────────── */
const ICONS = {
    products: (
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
        </svg>
    ),
    orders: (
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
        </svg>
    ),
    settings: (
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
    ),
    reviews: (
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
    ),
    homepage: (
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
    ),
};

/* ── Stat card icon SVGs ──────────────────────────────────────────────── */
const STAT_ICONS = {
    orders: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
        </svg>
    ),
    revenue: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
        </svg>
    ),
    products: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
        </svg>
    ),
    lowStock: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
    ),
    pending: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
    ),
};

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
}

export default function AdminDashboard() {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState("products");

    // Sub-components report their data up via callbacks so the stats bar stays current
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [reviewCount, setReviewCount] = useState(0);

    const stats = useMemo(() => {
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((s, o) => s + Number(o.computed_total_inr || 0), 0);
        const activeProducts = products.filter((p) => p.is_active).length;
        const lowStock = products.filter(
            (p) => p.is_active && Number(p.stock_qty || 0) <= LOW_STOCK_THRESHOLD
        ).length;
        const pendingOrders = orders.filter(
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

    const adminName = profile?.full_name?.split(" ")[0] || profile?.email?.split("@")[0] || "Admin";

    const tab = (id, label, icon, badge, badgeStyle) => (
        <button
            type="button"
            onClick={() => setActiveTab(id)}
            className={[
                "shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 flex items-center gap-2",
                activeTab === id
                    ? "border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-md shadow-[#1e3a5f]/20"
                    : "border-[#E8E4DE] bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900 hover:border-stone-300",
            ].join(" ")}
        >
            {icon}
            {label}
            {badge > 0 && (
                <span className={[
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                    activeTab === id
                        ? "bg-white/90 text-[#1e3a5f]"
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
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                        <p className="section-label">Admin Dashboard</p>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
                            {getGreeting()}, {adminName}
                        </h1>
                        <p className="mt-1.5 text-sm text-stone-500">
                            Signed in as <span className="font-medium text-stone-700">{profile?.email}</span>
                        </p>
                    </div>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 shrink-0 rounded-xl border border-[#E8E4DE] bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-all shadow-sm"
                    >
                        <svg className="h-4 w-4 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                        </svg>
                        View live site
                    </Link>
                </div>

                {/* ── Stats Row ── */}
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <StatCard icon={STAT_ICONS.orders} label="Total Orders" value={stats.totalOrders} iconBg="bg-blue-50" iconColor="text-blue-500" />
                    <StatCard icon={STAT_ICONS.revenue} label="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString("en-IN")}`} iconBg="bg-emerald-50" iconColor="text-emerald-500" />
                    <StatCard icon={STAT_ICONS.products} label="Active Products" value={stats.activeProducts} iconBg="bg-violet-50" iconColor="text-violet-500" />
                    <StatCard
                        icon={STAT_ICONS.lowStock}
                        label="Low Stock"
                        value={stats.lowStock}
                        sub={stats.lowStock > 0 ? `≤${LOW_STOCK_THRESHOLD} units` : "All stocked"}
                        warn={stats.lowStock > 0} warnColor="amber"
                        iconBg="bg-amber-50" iconColor="text-amber-500"
                    />
                    <StatCard
                        icon={STAT_ICONS.pending}
                        label="Pending"
                        value={stats.pendingOrders}
                        sub={stats.pendingOrders > 0 ? "Need action" : "All clear"}
                        warn={stats.pendingOrders > 0} warnColor="blue"
                        iconBg="bg-sky-50" iconColor="text-sky-500"
                    />
                </div>

                {/* ── Tab Bar ── */}
                <div className="mt-8 -mx-4 px-4 flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
                    {tab("products", "Products", ICONS.products)}
                    {tab("orders", "Orders", ICONS.orders, stats.pendingOrders)}
                    {tab("settings", "Settings", ICONS.settings)}
                    {tab("reviews", "Reviews", ICONS.reviews, reviewCount, "bg-neutral-200 text-stone-600")}
                    {tab("homepage", "Homepage", ICONS.homepage)}
                    <div className="hidden md:block ml-auto text-xs text-stone-400">
                        {activeTab === "products" && `${products.length} products`}
                        {activeTab === "orders" && `${orders.length} orders`}
                        {activeTab === "reviews" && `${reviewCount} reviews`}
                        {activeTab === "settings" && "App settings"}
                        {activeTab === "homepage" && "Homepage editor"}
                    </div>
                </div>

                {/* ── Tab Panels — always mounted, hidden via CSS ── */}
                <div className="mt-6">
                    <div {...panel("products")}><AdminProducts onProductsChange={setProducts} /></div>
                    <div {...panel("orders")}  ><AdminOrders onOrdersChange={setOrders} /></div>
                    <div {...panel("settings")}><AdminSettings /></div>
                    {/*
                      Reviews and Homepage are always rendered (never conditionally removed)
                      so Reviews fires onCountChange on mount, and Homepage keeps its
                      unsaved form state while you switch to another tab.
                    */}
                    <div {...panel("reviews")} ><AdminReviews onCountChange={setReviewCount} /></div>
                    <div {...panel("homepage")}><AdminHomepage products={products} /></div>
                </div>

            </div>
        </div>
    );
}

function StatCard({ icon, label, value, sub, warn, warnColor, iconBg, iconColor }) {
    const palette = {
        amber: { wrap: "border-amber-200 bg-amber-50/60", lbl: "text-amber-700", val: "text-amber-800", sub: "text-amber-600" },
        blue: { wrap: "border-blue-200 bg-blue-50/60", lbl: "text-blue-700", val: "text-blue-800", sub: "text-blue-600" },
    };
    const p = warn && warnColor ? palette[warnColor] : null;
    return (
        <div className={["rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md", p ? p.wrap : "border-[#E8E4DE] bg-white"].join(" ")}>
            <div className="flex items-center gap-3">
                <div className={["h-9 w-9 rounded-xl grid place-items-center shrink-0", p ? p.wrap : (iconBg || "bg-stone-100")].join(" ")}>
                    <span className={p ? p.lbl : (iconColor || "text-stone-500")}>{icon}</span>
                </div>
                <div className="min-w-0">
                    <div className={["text-[11px] font-medium uppercase tracking-wide", p ? p.lbl : "text-stone-400"].join(" ")}>{label}</div>
                    <div className={["text-xl font-bold leading-tight", p ? p.val : "text-stone-900"].join(" ")}>{value}</div>
                </div>
            </div>
            {sub && <div className={["mt-2 text-[11px]", p ? p.sub : "text-stone-400"].join(" ")}>{sub}</div>}
        </div>
    );
}

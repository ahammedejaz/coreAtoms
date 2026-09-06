/**
 * AdminDashboard.jsx — Shell only.
 * Tab components are always mounted but hidden with CSS so their state and
 * data survives tab switches. This prevents the Homepage editor from losing
 * unsaved changes when you click away, and lets Reviews load its count on
 * app start without needing a tab visit.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AdminProducts from "./admin/AdminProducts.jsx";
import AdminOrders from "./admin/AdminOrders.jsx";
import AdminHomepage from "./admin/AdminHomepage.jsx";
import AdminReviews from "./admin/AdminReviews.jsx";
import AdminSettings from "./admin/AdminSettings.jsx";
import AdminReplacements from "./admin/AdminReplacements.jsx";
import AdminCoreCoins from "./admin/AdminCoreCoins.jsx";
import AdminSiteContent from "./admin/AdminSiteContent.jsx";

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
    replacements: (
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
        </svg>
    ),
    corecoins: (
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm1 11H9v-1.5l3-2V8H9V6.5h4V10l-2 1.5V13z" />
        </svg>
    ),
    content: (
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
            <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
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
    const [replacementCount, setReplacementCount] = useState(0);

    const stats = useMemo(() => {
        const statusOf = (o) => String(o.status || "").toLowerCase();
        const countOf = (status) => orders.filter((o) => statusOf(o) === status).length;

        const totalOrders = orders.length;
        const totalRevenue = orders
            .filter((o) => statusOf(o) === "delivered")
            .reduce((s, o) => s + Number(o.computed_total_inr || 0), 0);
        const activeProducts = products.filter((p) => p.is_active).length;
        const lowStock = products.filter(
            (p) => p.is_active && Number(p.stock_qty || 0) <= LOW_STOCK_THRESHOLD
        ).length;
        // Needs admin attention — an order still waiting to be picked up and shipped.
        const pendingOrders = orders.filter(
            (o) => ["placed", "confirmed", "processing"].includes(statusOf(o))
        ).length;
        // Every live order that has not been delivered (or cancelled / failed) yet,
        // so each status sits in exactly one of the two money buckets.
        const pendingSalesAmount = orders
            .filter((o) => ["placed", "confirmed", "processing", "shipped", "out_for_delivery"].includes(statusOf(o)))
            .reduce((s, o) => s + Number(o.computed_total_inr || 0), 0);
        return {
            totalOrders, totalRevenue, activeProducts, lowStock, pendingOrders, pendingSalesAmount,
            placedCount: countOf("placed"),
            confirmedCount: countOf("confirmed"),
            processingCount: countOf("processing"),
            shippedCount: countOf("shipped"),
            outForDeliveryCount: countOf("out_for_delivery"),
            deliveredCount: countOf("delivered"),
        };
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

    const TABS = [
        { id: "products", label: "Products", icon: ICONS.products, count: `${products.length} products` },
        { id: "orders", label: "Orders", icon: ICONS.orders, badge: stats.pendingOrders, count: `${orders.length} orders` },
        { id: "settings", label: "Settings", icon: ICONS.settings, count: "App settings" },
        { id: "replacements", label: "Replacements", icon: ICONS.replacements, badge: replacementCount, count: `${replacementCount} pending` },
        { id: "reviews", label: "Reviews", icon: ICONS.reviews, badge: reviewCount, quiet: true, count: `${reviewCount} reviews` },
        { id: "homepage", label: "Homepage", icon: ICONS.homepage, count: "Homepage editor" },
        { id: "content", label: "Site content", icon: ICONS.content, count: "Every page's copy" },
        { id: "corecoins", label: "CoreCoins", icon: ICONS.corecoins, count: "Loyalty wallets" },
    ];
    const current = TABS.find((t) => t.id === activeTab) || TABS[0];

    // Helper: show/hide a tab panel without unmounting it
    const panel = (id) => ({ className: activeTab === id ? "" : "hidden" });

    const statusRows = [
        { label: "Placed", value: stats.placedCount, cls: "bg-green-50 text-green-700" },
        { label: "Confirmed", value: stats.confirmedCount, cls: "bg-teal-50 text-teal-700" },
        { label: "Processing", value: stats.processingCount, cls: "bg-yellow-50 text-yellow-700" },
        { label: "Shipped", value: stats.shippedCount, cls: "bg-blue-50 text-blue-700" },
        { label: "Out for delivery", value: stats.outForDeliveryCount, cls: "bg-indigo-50 text-indigo-700" },
        { label: "Delivered", value: stats.deliveredCount, cls: "bg-emerald-50 text-emerald-700" },
    ];

    return (
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 sm:pt-8 lg:px-8">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="font-display text-[1.6rem] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-3xl">
                        {getGreeting()}, {adminName}
                    </h1>
                    <p className="mt-1 truncate text-[13px] text-stone-500">{profile?.email}</p>
                </div>
                <Link to="/shop" className="btn-secondary h-10 shrink-0 px-3.5 text-[13px] sm:px-4">
                    <svg className="h-4 w-4 text-stone-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                    <span className="hidden sm:inline">View live site</span>
                    <span className="sm:hidden">Live site</span>
                </Link>
            </div>

            {/* ── Stats: a scrolling rail on phones, a grid from the tablet up ── */}
            <div className="mt-5 -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
                <StatCard label="Orders" value={stats.totalOrders} />
                <StatCard label="Sales" value={`₹${stats.totalRevenue.toLocaleString("en-IN")}`} sub="Delivered" />
                <StatCard label="Pending" value={`₹${stats.pendingSalesAmount.toLocaleString("en-IN")}`} sub="Not yet delivered" tone={stats.pendingSalesAmount > 0 ? "blue" : null} />
                <StatCard label="Active" value={stats.activeProducts} sub="Products live" />
                <StatCard label="Low stock" value={stats.lowStock} sub={stats.lowStock > 0 ? `≤${LOW_STOCK_THRESHOLD} units` : "All stocked"} tone={stats.lowStock > 0 ? "amber" : null} />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
                {statusRows.map((row) => (
                    <span key={row.label} className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold ${row.cls}`}>
                        {row.label}
                        <span className="tabular-nums text-ink">{row.value}</span>
                    </span>
                ))}
            </div>

            {/* ── Tab strip: sticky under the site header, scrolls sideways on phones ── */}
            <div className="sticky top-16 z-30 -mx-4 mt-5 border-b border-line bg-canvas/90 backdrop-blur-md sm:-mx-6 lg:-mx-8">
                <div className="flex snap-x gap-1.5 overflow-x-auto px-4 py-2.5 no-scrollbar sm:px-6 lg:px-8 [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1.5rem),transparent)] sm:[mask-image:none]" role="tablist" aria-label="Admin sections">
                    {TABS.map((t) => (
                        <TabButton key={t.id} tab={t} active={activeTab === t.id} onSelect={() => setActiveTab(t.id)} />
                    ))}
                </div>
            </div>

            <p className="mt-4 text-[12.5px] text-stone-500">
                <span className="font-semibold text-ink">{current.label}</span>
                <span className="mx-1.5 text-stone-300">·</span>
                {current.count}
            </p>

            {/* ── Tab Panels — always mounted, hidden via CSS ──
                Every tab registers its own global Ctrl+S listener, so each one
                gets `isActive` and ignores the shortcut unless it is on screen.
                Without it a single Ctrl+S fires all seven tabs' handlers. */}
            <div className="mt-3">
                <div {...panel("products")}><AdminProducts onProductsChange={setProducts} isActive={activeTab === "products"} /></div>
                <div {...panel("orders")}  ><AdminOrders onOrdersChange={setOrders} isActive={activeTab === "orders"} /></div>
                <div {...panel("settings")}><AdminSettings isActive={activeTab === "settings"} /></div>
                <div {...panel("reviews")} ><AdminReviews onCountChange={setReviewCount} isActive={activeTab === "reviews"} /></div>
                <div {...panel("homepage")}><AdminHomepage products={products} isActive={activeTab === "homepage"} /></div>
                <div {...panel("content")}><AdminSiteContent isActive={activeTab === "content"} /></div>
                <div {...panel("replacements")}><AdminReplacements onCountChange={setReplacementCount} /></div>
                <div {...panel("corecoins")}><AdminCoreCoins /></div>
            </div>
        </div>
    );
}

/** One pill in the strip. The active one scrolls itself into view so it is never hidden off the edge of a phone. */
function TabButton({ tab, active, onSelect }) {
    const ref = useRef(null);
    useEffect(() => {
        if (active) ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, [active]);
    return (
        <button
            ref={ref}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onSelect}
            className={[
                "inline-flex h-10 shrink-0 snap-start items-center gap-2 rounded-full border px-3.5 text-[13.5px] font-semibold transition-[background-color,border-color,color,transform] duration-150 ease-out-strong active:scale-[0.97]",
                active ? "border-ink bg-ink text-white" : "border-line bg-white text-stone-600 hover:border-line-strong hover:text-ink",
            ].join(" ")}
        >
            <span className={active ? "text-white/80" : "text-stone-400"}>{tab.icon}</span>
            {tab.label}
            {tab.badge > 0 && (
                <span className={[
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                    active ? "bg-white/90 text-ink" : tab.quiet ? "bg-bone-deep text-stone-600" : "bg-red-500 text-white",
                ].join(" ")}>
                    {tab.badge}
                </span>
            )}
        </button>
    );
}

function StatCard({ label, value, sub, tone }) {
    const tones = {
        amber: "border-amber-200 bg-amber-50/70 [&_.v]:text-amber-800 [&_.l]:text-amber-700",
        blue: "border-navy-200 bg-brand-soft [&_.v]:text-brand [&_.l]:text-navy-700",
    };
    return (
        <div className={["min-w-[8.25rem] shrink-0 snap-start rounded-2xl border px-3.5 py-3 sm:min-w-0", tone ? tones[tone] : "border-line bg-white"].join(" ")}>
            <div className="l text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-400">{label}</div>
            <div className="v mt-1 font-display text-[1.35rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink">{value}</div>
            {sub && <div className="mt-1.5 text-[11px] text-stone-400">{sub}</div>}
        </div>
    );
}

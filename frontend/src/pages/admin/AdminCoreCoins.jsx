/**
 * AdminCoreCoins.jsx — Read-only CoreCoins wallet overview for admins.
 *
 * Shows all customer wallets with their current balance, paginated (50/page).
 * Balances are managed exclusively by the DB trigger (`credit_corecoins`)
 * and the `process_pending_corecoins` RPC. Admins cannot manually adjust balances.
 *
 * Displays: user email, balance (coins), and a search filter.
 *
 * @module pages/admin/AdminCoreCoins
 */
import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { useToast } from "../../context/ToastContext";

/**
 * Defaults must match the database. `credit_corecoins` and
 * `process_pending_corecoins` both fall back to earn_rate 2; defaulting to 1
 * here reported half the coins the database would actually award.
 */
const DEFAULT_CONFIG = { earn_rate: 2, earn_per_rupees: 100, coin_value_inr: 1 };

/**
 * Coins an order will earn, computed exactly as the database computes them.
 *
 * The earn base ADDS back the coins the customer redeemed — loyalty accrues on
 * the value of the goods, not on the cash that changed hands. This page used to
 * subtract them, so every order paid partly in coins was projected low, and the
 * gap grew with the size of the redemption.
 */
function projectedCoins(order, cfg) {
    const earnPer = Number(cfg.earn_per_rupees || 100);
    if (!(earnPer > 0)) return 0;
    const netPaid =
        Number(order.total_amount_inr || 0) +
        Number(order.coins_used || 0) * Number(cfg.coin_value_inr || 1);
    return Math.max(0, Math.floor((netPaid / earnPer) * Number(cfg.earn_rate || 2)));
}

export default function AdminCoreCoins() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState("");
    const [wallets, setWallets] = useState([]);
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("balance"); // balance | pending | name
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [totalStats, setTotalStats] = useState({ users: 0, total_coins: 0, total_value: 0, pending_coins: 0, due_coins: 0 });
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    const load = async () => {
        setLoading(true);
        setLoadErr("");
        try {
            const [{ data: cfgData, error: cfgErr }, { data: walletData, error: walletErr }] =
                await Promise.all([
                    supabase.from("app_settings").select("value")
                        .eq("key", "corecoins_config").maybeSingle(),
                    supabase.from("corecoins_wallet").select("user_id, balance, updated_at"),
                ]);
            if (cfgErr) throw cfgErr;
            if (walletErr) throw walletErr;

            const cfg = { ...DEFAULT_CONFIG, ...(cfgData?.value || {}) };
            setConfig(cfg);
            const coinVal = Number(cfg.coin_value_inr || 1);

            // Load profile data for users
            const userIds = (walletData || []).map((w) => w.user_id).filter(Boolean);
            const profileMap = {};
            if (userIds.length > 0) {
                const { data: profiles, error: profileErr } = await supabase
                    .from("profiles").select("id, email, full_name")
                    .in("id", userIds);
                if (profileErr) throw profileErr;
                (profiles || []).forEach((p) => { profileMap[p.id] = p; });
            }

            // Delivered orders that have earned coins but not received them yet.
            const { data: pendingOrders, error: pendingErr } = await supabase
                .from("orders")
                .select("user_id, total_amount_inr, coins_used, coins_credit_after, coins_credited_amount")
                .eq("status", "delivered")
                .eq("coins_credited", false)
                .not("coins_credit_after", "is", null);
            if (pendingErr) throw pendingErr;

            // A future `coins_credit_after` means the replacement window is still
            // open. A past one means the coins are already owed and are only
            // waiting for the customer's next visit to run
            // `process_pending_corecoins`. The old query filtered to the first
            // group, so coins that were genuinely due appeared nowhere at all.
            const now = Date.now();
            const pending = {};
            const due = {};
            (pendingOrders || []).forEach((o) => {
                // The trigger records what it worked out at delivery time. Prefer
                // that over re-deriving it, so a later config change cannot make
                // this page disagree with what will actually be paid out.
                const coins = o.coins_credited_amount ?? projectedCoins(o, cfg);
                if (coins <= 0) return;
                const bucket = new Date(o.coins_credit_after).getTime() > now ? pending : due;
                bucket[o.user_id] = (bucket[o.user_id] || 0) + coins;
            });

            // Build enriched wallet list
            const enriched = (walletData || []).map((w) => {
                const prof = profileMap[w.user_id] || {};
                const balance = Number(w.balance || 0);
                return {
                    ...w,
                    balance,
                    email: prof.email || "—",
                    name: prof.full_name || "—",
                    pending: pending[w.user_id] || 0,
                    due: due[w.user_id] || 0,
                    value_inr: Math.floor(balance * coinVal),
                };
            });
            setWallets(enriched);

            // Stats
            const totalCoins = enriched.reduce((s, w) => s + w.balance, 0);
            const sum = (m) => Object.values(m).reduce((s, v) => s + v, 0);
            setTotalStats({
                users: enriched.length,
                total_coins: totalCoins,
                total_value: Math.floor(totalCoins * coinVal),
                pending_coins: sum(pending),
                due_coins: sum(due),
            });
        } catch (e) {
            // Show the failure instead of leaving the previous numbers on screen
            // looking current — these are balances someone acts on.
            setLoadErr(e.message || "Failed to load CoreCoins data");
            showToast(e.message || "Failed to load CoreCoins data", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []); // eslint-disable-line

    const filtered = wallets
        .filter((w) => {
            if (!search.trim()) return true;
            const q = search.trim().toLowerCase();
            return w.email.toLowerCase().includes(q) || w.name.toLowerCase().includes(q) || w.user_id.toLowerCase().includes(q);
        })
        .sort((a, b) => {
            if (sortBy === "balance") return b.balance - a.balance;
            if (sortBy === "pending") return (b.pending + b.due) - (a.pending + a.due);
            if (sortBy === "name") return a.name.localeCompare(b.name);
            return 0;
        });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const handleSearch = (v) => { setSearch(v); setPage(1); };
    const handleSort = (v) => { setSortBy(v); setPage(1); };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <div className="text-base font-semibold text-stone-900">CoreCoins Wallets</div>
                    <div className="text-xs text-stone-400 mt-0.5">Live balances across all customers. Coins are earned and credited automatically.</div>
                </div>
                <button type="button" onClick={load} disabled={loading}
                    className="self-start shrink-0 rounded-xl border border-[#E8E4DE] bg-white px-3.5 py-2 text-xs font-semibold text-stone-600 hover:border-stone-400 hover:text-stone-800 disabled:opacity-40 transition-all flex items-center gap-1.5">
                    <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                    Refresh
                </button>
            </div>

            {loadErr && (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex flex-wrap items-center gap-3">
                    <span className="flex-1 min-w-0">
                        <strong className="font-semibold">Couldn’t load wallet data.</strong> The figures below may be out of date. {loadErr}
                    </span>
                    <button type="button" onClick={load}
                        className="shrink-0 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
                        Try again
                    </button>
                </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                    { label: "Users with Wallets", value: totalStats.users, color: "text-stone-900", bg: "bg-white" },
                    { label: "Total Coins Issued", value: totalStats.total_coins.toLocaleString("en-IN"), color: "text-amber-700", bg: "bg-amber-50" },
                    { label: "Total Wallet Value", value: `₹${totalStats.total_value.toLocaleString("en-IN")}`, color: "text-emerald-700", bg: "bg-emerald-50" },
                    { label: "Pending (window open)", value: totalStats.pending_coins.toLocaleString("en-IN"), color: "text-blue-700", bg: "bg-blue-50" },
                    { label: "Owed (window closed)", value: totalStats.due_coins.toLocaleString("en-IN"), color: "text-violet-700", bg: "bg-violet-50" },
                ].map((s) => (
                    <div key={s.label} className={`rounded-2xl border border-[#E8E4DE] ${s.bg} p-4`}>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-stone-400">{s.label}</div>
                        <div className={`mt-1 text-xl font-bold ${s.color}`}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Config pill */}
            <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 border border-stone-200 px-3 py-1 font-medium text-stone-600">
                    Earn rate: <strong>{config.earn_rate} coin per ₹{config.earn_per_rupees}</strong>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 border border-stone-200 px-3 py-1 font-medium text-stone-600">
                    Coin value: <strong>₹{config.coin_value_inr} each</strong>
                </span>
                <span className="text-stone-400 self-center">· Change these in Admin Settings → CoreCoins</span>
            </div>

            {/* Filter & sort */}
            <div className="flex flex-col sm:flex-row gap-3">
                <input
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    className="flex-1 rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-amber-400/30 outline-none"
                />
                <select
                    value={sortBy}
                    onChange={(e) => handleSort(e.target.value)}
                    className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-700 outline-none"
                >
                    <option value="balance">Sort: Highest balance</option>
                    <option value="pending">Sort: Most pending</option>
                    <option value="name">Sort: Name A–Z</option>
                </select>
            </div>

            {/* Table */}
            {loading ? (
                <div className="py-10 text-center text-sm text-stone-400 animate-pulse">Loading wallets…</div>
            ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-stone-400">
                    {wallets.length === 0 ? "No CoreCoins wallets yet — customers will appear here after earning coins." : "No results match your search."}
                </div>
            ) : (
                <div className="rounded-2xl border border-[#E8E4DE] overflow-hidden">
                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#E8E4DE] bg-stone-50">
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">Customer</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-stone-400">Balance</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-stone-400">Value (₹)</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-stone-400">Pending</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-stone-400">Last Updated</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E8E4DE] bg-white">
                                {paginated.map((w) => (
                                    <tr key={w.user_id} className="hover:bg-stone-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-stone-900">{w.name !== "—" ? w.name : w.email}</div>
                                            <div className="text-xs text-stone-400">{w.email}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                                <svg className="h-3.5 w-3.5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" />
                                                </svg>
                                                {w.balance.toLocaleString("en-IN")}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-stone-700 font-medium">
                                            ₹{w.value_inr.toLocaleString("en-IN")}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {w.pending > 0 || w.due > 0 ? (
                                                <div className="flex flex-col items-end gap-0.5">
                                                    {w.pending > 0 && (
                                                        <span className="inline-flex items-center gap-1 text-blue-600 font-medium" title="Replacement window still open">
                                                            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                                            </svg>
                                                            +{w.pending.toLocaleString("en-IN")}
                                                        </span>
                                                    )}
                                                    {w.due > 0 && (
                                                        <span className="text-[11px] font-semibold text-violet-700" title="Window closed — credited on the customer's next visit">
                                                            {w.due.toLocaleString("en-IN")} owed
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-stone-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs text-stone-400">
                                            {w.updated_at ? new Date(w.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden divide-y divide-[#E8E4DE]">
                        {paginated.map((w) => (
                            <div key={w.user_id} className="bg-white px-4 py-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-medium text-stone-900 truncate">{w.name !== "—" ? w.name : w.email}</div>
                                        <div className="text-xs text-stone-400 truncate">{w.email}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="font-bold text-amber-700">{w.balance.toLocaleString("en-IN")} coins</div>
                                        <div className="text-xs text-stone-500">₹{w.value_inr.toLocaleString("en-IN")}</div>
                                    </div>
                                </div>
                                {w.pending > 0 && (
                                    <div className="mt-1.5 text-xs text-blue-600 font-medium">
                                        +{w.pending} coins pending (window open)
                                    </div>
                                )}
                                {w.due > 0 && (
                                    <div className="mt-1 text-xs text-violet-700 font-medium">
                                        {w.due} coins owed (window closed)
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-stone-400">
                    Showing {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} wallets
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={safePage === 1}
                            className="h-8 w-8 rounded-xl border border-[#E8E4DE] bg-white text-stone-500 hover:bg-stone-50 disabled:opacity-30 flex items-center justify-center transition"
                        >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                            .reduce((acc, p, idx, arr) => {
                                if (idx > 0 && p - arr[idx - 1] > 1) acc.push("…");
                                acc.push(p);
                                return acc;
                            }, [])
                            .map((p, i) =>
                                p === "…" ? (
                                    <span key={`ellipsis-${i}`} className="px-1 text-xs text-stone-400">…</span>
                                ) : (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPage(p)}
                                        className={`h-8 min-w-8 px-2 rounded-xl border text-xs font-semibold transition ${p === safePage
                                            ? "border-[#1e3a5f] bg-[#1e3a5f] text-white"
                                            : "border-[#E8E4DE] bg-white text-stone-600 hover:bg-stone-50"
                                            }`}
                                    >{p}</button>
                                )
                            )
                        }
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage === totalPages}
                            className="h-8 w-8 rounded-xl border border-[#E8E4DE] bg-white text-stone-500 hover:bg-stone-50 disabled:opacity-30 flex items-center justify-center transition"
                        >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

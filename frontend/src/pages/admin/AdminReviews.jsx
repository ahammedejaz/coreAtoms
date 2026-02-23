import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase/client";

export default function AdminReviews({ onCountChange }) {
    const [reviews, setReviews]     = useState([]);
    const [loading, setLoading]     = useState(true);
    const [err, setErr]             = useState("");
    const [search, setSearch]       = useState("");

    const load = async () => {
        setLoading(true); setErr("");
        const { data, error } = await supabase
            .from("product_reviews")
            .select("id,rating,title,body,created_at,product_id,user_id,order_id,products(name)")
            .order("created_at", { ascending: false });
        if (error) { setErr(error.message); setLoading(false); return; }

        const raw = data || [];
        const userIds = [...new Set(raw.map((r) => r.user_id).filter(Boolean))];
        const profileMap = {};
        if (userIds.length) {
            const { data: pr } = await supabase.from("profiles").select("id,full_name,email").in("id", userIds);
            (pr || []).forEach((p) => { profileMap[p.id] = p; });
        }
        const enriched = raw.map((r) => ({ ...r, _profile: profileMap[r.user_id] || null }));
        setReviews(enriched);
        onCountChange?.(enriched.length);
        setLoading(false);
    };

    // Load on mount so the badge in the shell shows the count immediately
    useEffect(() => { load(); }, []); // eslint-disable-line

    const remove = async (id) => {
        if (!window.confirm("Delete this review?")) return;
        const { error } = await supabase.from("product_reviews").delete().eq("id", id);
        if (error) { alert(error.message); return; }
        setReviews((prev) => {
            const next = prev.filter((r) => r.id !== id);
            onCountChange?.(next.length);
            return next;
        });
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return reviews;
        return reviews.filter((r) =>
            [r.products?.name, r._profile?.full_name, r._profile?.email, r.title, r.body]
                .some((s) => String(s || "").toLowerCase().includes(q))
        );
    }, [reviews, search]);

    return (
        <div className="rounded-2xl border border-[#E8E4DE] bg-white p-5">
            <div className="text-base font-semibold text-stone-900">Customer Reviews</div>
            <div className="mt-1 text-xs text-stone-400">View and moderate reviews. Deletion is permanent.</div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by product, customer, or text…"
                    className="w-full sm:w-80 rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none" />
                {search && <button type="button" onClick={() => setSearch("")} className="text-xs text-stone-400 hover:text-stone-700">Clear</button>}
                <div className="ml-auto text-xs text-stone-400">{filtered.length} of {reviews.length}</div>
                <button type="button" onClick={load} className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs font-semibold text-stone-900 hover:bg-stone-50">↺ Refresh</button>
            </div>

            {err && <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{err}</div>}

            {loading ? (
                <div className="mt-6 text-sm text-stone-400 animate-pulse">Loading reviews…</div>
            ) : filtered.length === 0 ? (
                <div className="mt-6 text-sm text-stone-400">{search ? "No matches." : "No reviews yet."}</div>
            ) : (
                <div className="mt-5 space-y-4">
                    {filtered.map((r) => (
                        <div key={r.id} className="rounded-2xl border border-[#E8E4DE] bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-stone-900">
                                            {r._profile?.full_name || r._profile?.email || "Anonymous"}
                                        </span>
                                        {r._profile?.email && r._profile?.full_name && (
                                            <span className="text-xs text-stone-400">{r._profile.email}</span>
                                        )}
                                        <span className="text-amber-400 text-sm tracking-tight">
                                            {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                                        </span>
                                    </div>
                                    <div className="mt-1 text-xs text-stone-400">
                                        {r.products?.name || "Unknown product"} ·{" "}
                                        {r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                                    </div>
                                    {r.title && <p className="mt-2 text-sm font-semibold text-stone-800">{r.title}</p>}
                                    {r.body  && <p className="mt-1 text-sm text-stone-500 leading-relaxed">{r.body}</p>}
                                </div>
                                <button type="button" onClick={() => remove(r.id)}
                                    className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100">
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

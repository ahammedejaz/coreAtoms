import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { SkeletonAdminList } from "../../components/Skeleton";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useToast } from "../../context/ToastContext";
import useKeyboardShortcut from "../../hooks/useKeyboardShortcut";

export default function AdminReviews({ onCountChange }) {
    const { showToast } = useToast();
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [search, setSearch] = useState("");
    const [confirmDlg, setConfirmDlg] = useState(null);

    // Ctrl+S → refresh reviews
    const loadRef = useRef(null);
    const handleCtrlS = useCallback((e) => { e.preventDefault(); loadRef.current?.(); }, []);
    useKeyboardShortcut("ctrl+s", handleCtrlS);

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

    const remove = (id) => {
        const review = reviews.find((r) => r.id === id);
        setConfirmDlg({
            title: "Delete review?",
            message: `This review${review?.products?.name ? ` for "${review.products.name}"` : ""} will be permanently removed.`,
            confirmLabel: "Delete review",
            variant: "danger",
            onConfirm: async () => {
                setConfirmDlg(null);
                const { error } = await supabase.from("product_reviews").delete().eq("id", id);
                if (error) { showToast(error.message, "error"); return; }
                setReviews((prev) => {
                    const next = prev.filter((r) => r.id !== id);
                    onCountChange?.(next.length);
                    return next;
                });
                showToast("Review deleted", "success");
            },
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

    // Pagination
    const REVIEW_PAGE_SIZE = 10;
    const [reviewPage, setReviewPage] = useState(1);
    const reviewTotalPages = Math.max(1, Math.ceil(filtered.length / REVIEW_PAGE_SIZE));
    const reviewSafePage = Math.min(reviewPage, reviewTotalPages);
    const paginatedReviews = filtered.slice((reviewSafePage - 1) * REVIEW_PAGE_SIZE, reviewSafePage * REVIEW_PAGE_SIZE);

    useEffect(() => { setReviewPage(1); }, [search]);

    return (
        <>
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
                    <div className="mt-4"><SkeletonAdminList rows={4} /></div>
                ) : filtered.length === 0 ? (
                    <div className="mt-8 flex flex-col items-center py-10 text-center">
                        <div className="h-14 w-14 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
                            <svg className="h-7 w-7 text-stone-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        </div>
                        <div className="text-sm font-semibold text-stone-700">{search ? "No matching reviews" : "No reviews yet"}</div>
                        <p className="mt-1 text-xs text-stone-400 max-w-xs">{search ? "Try a different search term." : "Reviews will appear here once customers leave them."}</p>
                    </div>
                ) : (
                    <div className="mt-5 space-y-4">
                        {paginatedReviews.map((r) => (
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
                                        {r.body && <p className="mt-1 text-sm text-stone-500 leading-relaxed">{r.body}</p>}
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

                {filtered.length > REVIEW_PAGE_SIZE && (
                    <div className="mt-4 flex items-center justify-between">
                        <button type="button" onClick={() => setReviewPage(p => Math.max(1, p - 1))} disabled={reviewSafePage <= 1}
                            className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed">← Previous</button>
                        <span className="text-xs text-stone-400">Page {reviewSafePage} of {reviewTotalPages}</span>
                        <button type="button" onClick={() => setReviewPage(p => Math.min(reviewTotalPages, p + 1))} disabled={reviewSafePage >= reviewTotalPages}
                            className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed">Next →</button>
                    </div>
                )}
            </div>

            {confirmDlg && (
                <ConfirmDialog
                    {...confirmDlg}
                    onCancel={() => setConfirmDlg(null)}
                />
            )}
        </>
    );
}

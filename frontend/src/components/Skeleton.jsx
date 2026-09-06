/**
 * Skeleton.jsx — Reusable skeleton loading primitives.
 *
 * Provides shimmer-animated placeholder components for loading states:
 * - `SkeletonLine` — single line placeholder
 * - `SkeletonCard` — product card placeholder
 * - `SkeletonGrid` — grid of SkeletonCards
 * - `SkeletonOrderCard` — order card placeholder
 *
 * @module components/Skeleton
 */

/** Base shimmer block with configurable height and width. */
export function SkeletonLine({ className = "", style = {} }) {
    return (
        <div
            className={`animate-pulse rounded-lg bg-bone-deep ${className}`}
            style={style}
        />
    );
}

/** Product card skeleton matching ProductCard layout. */
export function SkeletonCard() {
    return (
        <div className="flex flex-col">
            <SkeletonLine className="w-full aspect-[4/5] rounded-tile bg-bone" />
            <div className="mt-4 flex justify-between gap-4">
                <SkeletonLine className="w-2/3 h-4" />
                <SkeletonLine className="w-1/6 h-4" />
            </div>
            <SkeletonLine className="mt-2 w-1/2 h-3" />
            <SkeletonLine className="mt-2 w-1/3 h-3" />
        </div>
    );
}

/** Grid of SkeletonCards for product listing pages. */
export function SkeletonGrid({ count = 6 }) {
    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}

/** Order card skeleton matching MyOrders order item. */
export function SkeletonOrderCard() {
    return (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
                <SkeletonLine className="w-32 h-4" />
                <SkeletonLine className="w-20 h-6 rounded-full" />
            </div>
            <SkeletonLine className="w-full h-3" />
            <div className="flex gap-3">
                <SkeletonLine className="w-12 h-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                    <SkeletonLine className="w-3/4 h-3" />
                    <SkeletonLine className="w-1/2 h-3" />
                </div>
            </div>
        </div>
    );
}

/** Product detail page skeleton. */
export function SkeletonProductDetail() {
    return (
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
            <SkeletonLine className="w-48 h-3" />
            <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-14">
                <div className="space-y-3">
                    <SkeletonLine className="w-full aspect-square rounded-[28px] bg-bone" />
                    <div className="flex gap-2">
                        {[1, 2, 3].map((i) => (
                            <SkeletonLine key={i} className="w-[72px] h-[72px] rounded-2xl" />
                        ))}
                    </div>
                </div>
                <div className="space-y-4 pt-2">
                    <SkeletonLine className="w-1/4 h-3" />
                    <SkeletonLine className="w-3/4 h-9" />
                    <SkeletonLine className="w-1/3 h-3" />
                    <SkeletonLine className="w-full h-3" />
                    <SkeletonLine className="w-5/6 h-3" />
                    <div className="flex gap-2 pt-4">
                        <SkeletonLine className="w-28 h-11 rounded-full" />
                        <SkeletonLine className="w-28 h-11 rounded-full" />
                    </div>
                    <SkeletonLine className="w-1/3 h-10 mt-4" />
                    <div className="flex gap-3 pt-2">
                        <SkeletonLine className="w-32 h-12 rounded-full" />
                        <SkeletonLine className="flex-1 h-12 rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Admin-specific skeletons ───────────────────────────────────────── */

/** Admin table skeleton — mimics a table with rows (for Products / Orders). */
export function SkeletonAdminTable({ rows = 5 }) {
    return (
        <div className="space-y-3">
            {/* Header bar skeleton */}
            <div className="flex items-center justify-between">
                <SkeletonLine className="w-40 h-4" />
                <SkeletonLine className="w-28 h-9 rounded-xl" />
            </div>
            {/* Search bar */}
            <SkeletonLine className="w-full h-10 rounded-xl" />
            {/* Table rows */}
            <div className="space-y-2">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4">
                        <SkeletonLine className="h-4 w-4 rounded shrink-0" />
                        <SkeletonLine className="h-10 w-10 rounded-lg shrink-0" />
                        <div className="flex-1 space-y-2">
                            <SkeletonLine className="w-2/3 h-4" />
                            <SkeletonLine className="w-1/3 h-3" />
                        </div>
                        <SkeletonLine className="w-16 h-6 rounded-full shrink-0" />
                        <SkeletonLine className="w-20 h-8 rounded-xl shrink-0" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Admin review list skeleton — mimics review cards. */
export function SkeletonAdminList({ rows = 4 }) {
    return (
        <div className="space-y-3">
            {/* Header + search */}
            <div className="flex items-center gap-3">
                <SkeletonLine className="flex-1 h-10 rounded-xl" />
                <SkeletonLine className="w-24 h-9 rounded-xl" />
            </div>
            {/* Review cards */}
            <div className="space-y-3">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <SkeletonLine className="w-24 h-4" />
                                <SkeletonLine className="w-20 h-4" />
                            </div>
                            <SkeletonLine className="w-16 h-7 rounded-xl" />
                        </div>
                        <SkeletonLine className="w-1/2 h-3" />
                        <SkeletonLine className="w-full h-3" />
                    </div>
                ))}
            </div>
        </div>
    );
}


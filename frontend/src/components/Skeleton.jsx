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
            className={`animate-pulse rounded-lg bg-stone-200 ${className}`}
            style={style}
        />
    );
}

/** Product card skeleton matching ProductCard layout. */
export function SkeletonCard() {
    return (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
            <SkeletonLine className="w-full" style={{ height: 180 }} />
            <SkeletonLine className="w-3/4 h-4" />
            <SkeletonLine className="w-1/2 h-3" />
            <SkeletonLine className="w-1/3 h-4" />
            <div className="flex gap-2 pt-1">
                <SkeletonLine className="flex-1 h-10" />
                <SkeletonLine className="w-20 h-10" />
            </div>
        </div>
    );
}

/** Grid of SkeletonCards for product listing pages. */
export function SkeletonGrid({ count = 6 }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="grid md:grid-cols-2 gap-8">
                {/* Image area */}
                <div className="space-y-3">
                    <SkeletonLine className="w-full rounded-2xl" style={{ height: 400 }} />
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map((i) => (
                            <SkeletonLine key={i} className="w-16 h-16 rounded-lg" />
                        ))}
                    </div>
                </div>
                {/* Info area */}
                <div className="space-y-4 pt-2">
                    <SkeletonLine className="w-1/3 h-3" />
                    <SkeletonLine className="w-3/4 h-7" />
                    <SkeletonLine className="w-1/4 h-6" />
                    <SkeletonLine className="w-full h-3" />
                    <SkeletonLine className="w-full h-3" />
                    <SkeletonLine className="w-2/3 h-3" />
                    <div className="flex gap-2 pt-4">
                        <SkeletonLine className="w-32 h-12 rounded-xl" />
                        <SkeletonLine className="flex-1 h-12 rounded-xl" />
                    </div>
                </div>
            </div>
        </div>
    );
}

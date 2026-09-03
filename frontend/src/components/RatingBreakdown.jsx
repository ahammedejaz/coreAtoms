/**
 * RatingBreakdown.jsx — 5-star distribution bars for the PDP reviews section.
 *
 * @param {{ reviews: Array<{rating}>, avgRating: number, reviewCount: number }} props
 * @module components/RatingBreakdown
 */
import { useMemo } from "react";

export default function RatingBreakdown({ reviews, avgRating, reviewCount }) {
  const counts = useMemo(
    () => [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((r) => Number(r.rating) === star).length,
    })),
    [reviews]
  );

  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
      <div>
        <div className="text-4xl font-semibold text-stone-900">{Number(avgRating).toFixed(1)}</div>
        <div className="flex items-center gap-1 mt-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={`text-lg leading-none ${i <= Math.round(avgRating) ? "text-amber-400" : "text-stone-200"}`}
            >★</span>
          ))}
        </div>
        <div className="text-xs text-stone-400 mt-1">{reviewCount} review{reviewCount !== 1 ? "s" : ""}</div>
      </div>
      <div className="space-y-1.5">
        {counts.map(({ star, count }) => (
          <div key={star} className="flex items-center gap-3 text-xs">
            <span className="w-6 text-stone-500">{star}★</span>
            <div className="h-2 flex-1 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${reviewCount ? Math.round((count / reviewCount) * 100) : 0}%` }}
                role="img"
                aria-label={`${count} of ${reviewCount} reviews rated ${star} stars`}
              />
            </div>
            <span className="w-6 text-right text-stone-500">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

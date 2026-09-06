/**
 * RatingBreakdown.jsx — 5-star distribution bars for the PDP reviews section.
 *
 * @param {{ reviews: Array<{rating}>, avgRating: number, reviewCount: number }} props
 * @module components/RatingBreakdown
 */
import { useMemo } from "react";
import { Star } from "lucide-react";

export default function RatingBreakdown({ reviews, avgRating, reviewCount }) {
  const counts = useMemo(
    () => [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((r) => Number(r.rating) === star).length,
    })),
    [reviews]
  );

  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-10">
      <div>
        <div className="font-display text-6xl font-semibold leading-none tracking-[-0.04em] text-ink tabular-nums">{Number(avgRating).toFixed(1)}</div>
        <div className="mt-2 flex items-center gap-0.5" aria-label={`${Number(avgRating).toFixed(1)} out of 5`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${i <= Math.round(avgRating) ? "text-amber" : "text-line-strong"}`}
              fill="currentColor"
              strokeWidth={0}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="mt-1.5 text-xs text-stone-500">{reviewCount} review{reviewCount !== 1 ? "s" : ""}</div>
      </div>
      <div className="space-y-2">
        {counts.map(({ star, count }) => (
          <div key={star} className="flex items-center gap-3 text-xs">
            <span className="w-4 text-right font-medium text-stone-600 tabular-nums">{star}</span>
            <Star className="h-3 w-3 text-stone-400" fill="currentColor" strokeWidth={0} aria-hidden="true" />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bone-deep">
              <div
                className="h-full rounded-full bg-amber"
                style={{ width: `${reviewCount ? Math.round((count / reviewCount) * 100) : 0}%` }}
                role="img"
                aria-label={`${count} of ${reviewCount} reviews rated ${star} stars`}
              />
            </div>
            <span className="w-5 text-right text-stone-500 tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

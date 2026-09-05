/**
 * Testimonials.jsx — Homepage "What customers say" section.
 *
 * Renders nothing when there are no reviews to show — `Home.jsx` fetches
 * reviews rated 4+ with a non-empty body via `fetchHomepageReviews()` and the
 * fetch never throws, so an empty array here just means the section is absent.
 *
 * The reviews run as a continuous strip (two strips in opposite directions
 * once there are enough of them) that pauses under the pointer. Bodies on
 * this store are a few words long, so a strip of small panels reads better
 * than a single pull-quote.
 *
 * @param {{ reviews: Array<{id, rating, title, body, reviewerName, productName}>, summary?: { average: number, count: number } }} props
 * @module components/Testimonials
 */
import { Star } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import RevealText from "./fx/RevealText";

function ReviewStars({ rating, className = "", iconClassName = "h-3.5 w-3.5" }) {
  return (
    <div className={`flex items-center gap-0.5 ${className}`} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${iconClassName} ${i <= rating ? "text-amber" : "text-line-strong"}`}
          fill="currentColor"
          strokeWidth={0}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function ReviewPanel({ r }) {
  return (
    <figure className="flex w-[280px] shrink-0 flex-col justify-between rounded-panel border border-line bg-white p-6 sm:w-[330px]">
      <div>
        <ReviewStars rating={r.rating} />
        <blockquote className="mt-4 font-display text-[19px] font-medium leading-snug tracking-tight text-ink line-clamp-4">
          {r.body}
        </blockquote>
      </div>
      <figcaption className="mt-6 text-[13px] text-stone-500">
        <span className="font-semibold text-ink">{r.reviewerName}</span>
        {r.productName && <span className="block truncate">on {r.productName}</span>}
      </figcaption>
    </figure>
  );
}

function Strip({ items, reverse = false, duration }) {
  const copy = (hidden) => (
    <ul className="flex gap-4 pr-4" aria-hidden={hidden || undefined}>
      {items.map((r) => <li key={r.id} className="flex"><ReviewPanel r={r} /></li>)}
    </ul>
  );
  return (
    <div className="marquee">
      <div className={`marquee-track ${reverse ? "is-reverse" : ""}`} style={{ "--marquee-duration": `${duration}s` }}>
        {copy(false)}
        {copy(true)}
      </div>
    </div>
  );
}

export default function Testimonials({ reviews, summary }) {
  if (!reviews?.length) return null;

  // Each strip needs enough panels to fill a wide screen twice over.
  const rowA = reviews.length >= 6 ? reviews.filter((_, i) => i % 2 === 0) : reviews;
  const rowB = reviews.length >= 6 ? reviews.filter((_, i) => i % 2 === 1) : null;
  const fill = (row) => (row.length < 5 ? [...row, ...row, ...row].slice(0, Math.max(5, row.length)).map((r, i) => ({ ...r, id: `${r.id}-${i}` })) : row);

  return (
    <section className="overflow-hidden py-14 lg:py-20" aria-labelledby="testimonials-heading">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <ScrollReveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <RevealText id="testimonials-heading" text="What customers say" className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl" />
            {summary?.count > 0 && (
              <div className="flex items-center gap-3 text-[14px] text-stone-600">
                <ReviewStars rating={Math.round(summary.average)} iconClassName="h-4 w-4" />
                <span><span className="font-semibold text-ink tabular-nums">{summary.average.toFixed(1)}</span> average across <span className="tabular-nums">{summary.count}</span> verified reviews</span>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>
      <div className="mt-10 space-y-4">
        <Strip items={fill(rowA)} duration={Math.max(36, fill(rowA).length * 9)} />
        {rowB && <Strip items={fill(rowB)} reverse duration={Math.max(40, fill(rowB).length * 10)} />}
      </div>
    </section>
  );
}

/**
 * Testimonials.jsx — Homepage "What customers say" section.
 *
 * `Home.jsx` fetches reviews rated 4+ with a non-empty body via
 * `fetchHomepageReviews()`; `quotable()` keeps the ones long enough to quote
 * and drops duplicates. With fewer than three, the store's average rating
 * stands alone as a slim band, and with no rating at all the section is absent.
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

/**
 * Keeps the reviews worth quoting: a body of at least a sentence, no
 * duplicates, preferring longer ones. One-word ratings ("Good", "Great")
 * read as filler when set in display type, so they never make the strip.
 */
export function quotable(reviews) {
  const seen = new Set();
  return [...(reviews || [])]
    .filter((r) => String(r.body || "").trim().length >= 24)
    .sort((a, b) => String(b.body).length - String(a.body).length)
    .filter((r) => {
      const key = `${String(r.body).trim().toLowerCase()}|${String(r.reviewerName || "").toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

/** With too few quotes, the store's rating stands on its own as a slim band. */
function RatingBand({ summary }) {
  return (
    <section className="border-y border-line bg-white py-8" aria-label="Customer rating">
      <ScrollReveal className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-center sm:flex-row sm:justify-between sm:text-left sm:px-6">
        <div className="flex items-center gap-3">
          <ReviewStars rating={Math.round(summary.average)} iconClassName="h-4.5 w-4.5" />
          <p className="text-[15px] text-stone-600">
            <span className="font-display text-xl font-semibold text-ink tabular-nums">{summary.average.toFixed(1)}</span>
            <span className="ml-1.5">average across <span className="font-semibold text-ink tabular-nums">{summary.count}</span> verified {summary.count === 1 ? "review" : "reviews"}</span>
          </p>
        </div>
        <p className="text-[13.5px] text-stone-500">Every review is written by a verified buyer and shown in full on the product's page.</p>
      </ScrollReveal>
    </section>
  );
}

export default function Testimonials({ reviews: raw, summary }) {
  const reviews = quotable(raw);
  if (reviews.length < 3) return summary?.count > 0 ? <RatingBand summary={summary} /> : null;

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

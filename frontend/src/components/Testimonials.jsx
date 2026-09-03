/**
 * Testimonials.jsx — Homepage "What customers say" section.
 *
 * Renders nothing when there are no reviews to show — `Home.jsx` fetches
 * reviews rated 4+ with a non-empty body via `fetchHomepageReviews()` and the
 * fetch never throws, so an empty array here just means the section is absent.
 *
 * @param {{ reviews: Array<{id, rating, title, body, reviewerName, productName}> }} props
 * @module components/Testimonials
 */
export default function Testimonials({ reviews }) {
  if (!reviews?.length) return null;

  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-8">
          <p className="section-label">Real reviews</p>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-stone-900">What customers say</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-2xl border border-line bg-white p-6">
              <div className="flex items-center gap-0.5 mb-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={`text-sm leading-none ${i <= r.rating ? "text-amber-400" : "text-stone-200"}`}>★</span>
                ))}
              </div>
              {r.title && <p className="font-semibold text-stone-900">{r.title}</p>}
              <p className="mt-2 text-sm text-stone-600 line-clamp-4">{r.body}</p>
              <p className="mt-4 text-xs text-stone-400">
                {r.reviewerName}
                {r.productName && <> · on {r.productName}</>}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

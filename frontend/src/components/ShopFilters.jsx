/**
 * ShopFilters.jsx — The filter rail shown on the Shop page.
 *
 * Rendered twice by Shop.jsx: once as the sticky desktop sidebar (`idPrefix="rail"`)
 * and once inside the mobile bottom sheet (`idPrefix="sheet"`) — the prefix keeps
 * each set of radio `name`s independent so selecting one doesn't move the other.
 *
 * @module components/ShopFilters
 */
import { PRICE_BANDS, RATING_OPTIONS, countActiveFilters } from "../utils/shopFilters";

export default function ShopFilters({ idPrefix, categories, categoryCounts, total, filters, onChange, onClear }) {
  return (
    <aside aria-label="Filters" className="text-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-stone-900">Filters</span>
        {countActiveFilters(filters) > 0 && (
          <button type="button" onClick={onClear} className="text-xs font-semibold text-brand hover:underline">
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-5">
        {/* Category */}
        <fieldset>
          <legend className="section-label mb-2">Category</legend>
          <div className="space-y-1.5">
            <label htmlFor={`${idPrefix}-category-all`} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                id={`${idPrefix}-category-all`}
                name={`${idPrefix}-category`}
                className="accent-brand"
                checked={filters.category === "All"}
                onChange={() => onChange("category", "All")}
              />
              <span className="text-stone-700">All ({total})</span>
            </label>
            {categories.map((c) => (
              <label key={c} htmlFor={`${idPrefix}-category-${c}`} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  id={`${idPrefix}-category-${c}`}
                  name={`${idPrefix}-category`}
                  className="accent-brand"
                  checked={filters.category === c}
                  onChange={() => onChange("category", c)}
                />
                <span className="text-stone-700">{c} ({categoryCounts[c] ?? 0})</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Price */}
        <fieldset>
          <legend className="section-label mb-2">Price</legend>
          <div className="space-y-1.5">
            <label htmlFor={`${idPrefix}-price-any`} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                id={`${idPrefix}-price-any`}
                name={`${idPrefix}-price`}
                className="accent-brand"
                checked={!filters.price}
                onChange={() => onChange("price", "")}
              />
              <span className="text-stone-700">Any</span>
            </label>
            {PRICE_BANDS.map((band) => (
              <label key={band.id} htmlFor={`${idPrefix}-price-${band.id}`} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  id={`${idPrefix}-price-${band.id}`}
                  name={`${idPrefix}-price`}
                  className="accent-brand"
                  checked={filters.price === band.id}
                  onChange={() => onChange("price", band.id)}
                />
                <span className="text-stone-700">{band.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Customer rating */}
        <fieldset>
          <legend className="section-label mb-2">Customer rating</legend>
          <div className="space-y-1.5">
            <label htmlFor={`${idPrefix}-rating-any`} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                id={`${idPrefix}-rating-any`}
                name={`${idPrefix}-rating`}
                className="accent-brand"
                checked={!filters.rating}
                onChange={() => onChange("rating", "")}
              />
              <span className="text-stone-700">Any</span>
            </label>
            {RATING_OPTIONS.map((option) => (
              <label key={option.id} htmlFor={`${idPrefix}-rating-${option.id}`} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  id={`${idPrefix}-rating-${option.id}`}
                  name={`${idPrefix}-rating`}
                  className="accent-brand"
                  checked={filters.rating === option.id}
                  onChange={() => onChange("rating", option.id)}
                />
                <span className="text-stone-700">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Offers */}
        <fieldset>
          <legend className="section-label mb-2">Offers</legend>
          <label htmlFor={`${idPrefix}-offer`} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              id={`${idPrefix}-offer`}
              className="accent-brand"
              checked={filters.offer}
              onChange={(e) => onChange("offer", e.target.checked)}
            />
            <span className="text-stone-700">On offer</span>
          </label>
        </fieldset>

        {/* Availability */}
        <fieldset>
          <legend className="section-label mb-2">Availability</legend>
          <label htmlFor={`${idPrefix}-stock`} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              id={`${idPrefix}-stock`}
              className="accent-brand"
              checked={filters.stock}
              onChange={(e) => onChange("stock", e.target.checked)}
            />
            <span className="text-stone-700">In stock only</span>
          </label>
        </fieldset>
      </div>
    </aside>
  );
}

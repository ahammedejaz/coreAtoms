/**
 * ShopFilters.jsx — The filter rail shown on the Shop page.
 *
 * Rendered twice by Shop.jsx: once as the sticky desktop sidebar (`idPrefix="rail"`)
 * and once inside the mobile bottom sheet (`idPrefix="sheet"`) — the prefix keeps
 * each set of radio `name`s independent so selecting one doesn't move the other.
 *
 * Native inputs, drawn in the house style: a navy-filled ring for radios and a
 * navy square with a check for boxes, so keyboard and screen-reader behaviour
 * stays exactly what the browser provides.
 *
 * @module components/ShopFilters
 */
import { Check } from "lucide-react";
import { PRICE_BANDS, RATING_OPTIONS, countActiveFilters } from "../utils/shopFilters";

/** DOM ids can't contain spaces or `&` — category names like "Bone & Muscle"
 *  do. `onChange` still receives the raw, unslugged category string. */
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");

const radioClass =
  "h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-full border border-line-strong bg-white transition-[border-width,border-color] duration-150 ease-out-strong checked:border-[6px] checked:border-brand";

function Radio({ id, name, checked, onChange, label, count }) {
  return (
    <label htmlFor={id} className="group flex cursor-pointer items-center justify-between gap-3 py-1.5">
      <span className="flex items-center gap-2.5">
        <input type="radio" id={id} name={name} className={radioClass} checked={checked} onChange={onChange} />
        <span className={`text-[14px] transition-colors ${checked ? "font-semibold text-ink" : "text-stone-700 group-hover:text-ink"}`}>{label}</span>
      </span>
      {count != null && <span className="text-xs tabular-nums text-stone-400">{count}</span>}
    </label>
  );
}

function Checkbox({ id, checked, onChange, label }) {
  return (
    <label htmlFor={id} className="group flex cursor-pointer items-center gap-2.5 py-1.5">
      <span className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <input
          type="checkbox"
          id={id}
          className="peer h-full w-full cursor-pointer appearance-none rounded-[5px] border border-line-strong bg-white transition-colors duration-150 checked:border-brand checked:bg-brand"
          checked={checked}
          onChange={onChange}
        />
        <Check className="pointer-events-none absolute h-3 w-3 text-white opacity-0 transition-opacity duration-100 peer-checked:opacity-100" strokeWidth={3} aria-hidden="true" />
      </span>
      <span className={`text-[14px] transition-colors ${checked ? "font-semibold text-ink" : "text-stone-700 group-hover:text-ink"}`}>{label}</span>
    </label>
  );
}

function Group({ title, children }) {
  return (
    <fieldset className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <legend className="mb-2 text-[13px] font-semibold text-ink">{title}</legend>
      <div>{children}</div>
    </fieldset>
  );
}

export default function ShopFilters({ idPrefix, categories, categoryCounts, total, filters, onChange, onClear }) {
  const activeCount = countActiveFilters(filters);
  return (
    <aside aria-label="Filters" className="text-sm">
      <div className="mb-5 flex items-center justify-between">
        <span className="font-display text-lg font-semibold tracking-tight text-ink">
          Filters
          {activeCount > 0 && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">{activeCount}</span>}
        </span>
        {activeCount > 0 && (
          <button type="button" onClick={onClear} className="text-xs font-semibold text-brand hover:underline underline-offset-4">
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-5">
        <Group title="Category">
          <Radio id={`${idPrefix}-category-all`} name={`${idPrefix}-category`} checked={filters.category === "All"} onChange={() => onChange("category", "All")} label="All" count={total} />
          {categories.map((c) => (
            <Radio key={c} id={`${idPrefix}-category-${slug(c)}`} name={`${idPrefix}-category`} checked={filters.category === c} onChange={() => onChange("category", c)} label={c} count={categoryCounts[c] ?? 0} />
          ))}
        </Group>

        <Group title="Price">
          <Radio id={`${idPrefix}-price-any`} name={`${idPrefix}-price`} checked={!filters.price} onChange={() => onChange("price", "")} label="Any" />
          {PRICE_BANDS.map((band) => (
            <Radio key={band.id} id={`${idPrefix}-price-${slug(band.id)}`} name={`${idPrefix}-price`} checked={filters.price === band.id} onChange={() => onChange("price", band.id)} label={band.label} />
          ))}
        </Group>

        <Group title="Customer rating">
          <Radio id={`${idPrefix}-rating-any`} name={`${idPrefix}-rating`} checked={!filters.rating} onChange={() => onChange("rating", "")} label="Any" />
          {RATING_OPTIONS.map((option) => (
            <Radio key={option.id} id={`${idPrefix}-rating-${slug(option.id)}`} name={`${idPrefix}-rating`} checked={filters.rating === option.id} onChange={() => onChange("rating", option.id)} label={option.label} />
          ))}
        </Group>

        <Group title="Offers and stock">
          <Checkbox id={`${idPrefix}-offer`} checked={filters.offer} onChange={(e) => onChange("offer", e.target.checked)} label="On offer" />
          <Checkbox id={`${idPrefix}-stock`} checked={filters.stock} onChange={(e) => onChange("stock", e.target.checked)} label="In stock only" />
        </Group>
      </div>
    </aside>
  );
}

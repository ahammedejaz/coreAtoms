/**
 * shopFilters.js — Pure filter logic for the Shop page's filter rail.
 *
 * URL-synced filter keys: category, price, rating, offer, stock (plus `q` for
 * search, owned by the header). Kept dependency-free so it can be unit tested
 * without React or a browser.
 *
 * @module utils/shopFilters
 */
import { discountPercent } from "./format";
import { isOutOfStock } from "../services/products";

export const PRICE_BANDS = [
  { id: "under-500", label: "Under ₹500", min: 0, max: 499.99 },
  { id: "500-999", label: "₹500 – ₹999", min: 500, max: 999.99 },
  { id: "1000-1999", label: "₹1,000 – ₹1,999", min: 1000, max: 1999.99 },
  { id: "2000-plus", label: "₹2,000 and above", min: 2000, max: Infinity },
];

export const RATING_OPTIONS = [
  { id: "4", label: "4★ & above", min: 4 },
  { id: "3", label: "3★ & above", min: 3 },
];

export const FILTER_KEYS = ["category", "price", "rating", "offer", "stock"];

/** Reads the current filter selection from URL search params. */
export function readFilters(searchParams) {
  return {
    category: searchParams.get("category") || "All",
    price: searchParams.get("price") || "",
    rating: searchParams.get("rating") || "",
    offer: searchParams.get("offer") === "1",
    stock: searchParams.get("stock") === "1",
  };
}

/** Applies the filter rail + search query to a product list, in a fixed order. */
export function applyFilters(list, filters, query) {
  let result = list.filter((p) => p.isActive !== false);

  if (filters.category && filters.category !== "All") {
    result = result.filter((p) => p.category === filters.category);
  }

  const q = (query || "").trim().toLowerCase();
  if (q) {
    result = result.filter(
      (p) => p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
    );
  }

  if (filters.price) {
    const band = PRICE_BANDS.find((b) => b.id === filters.price);
    if (band) {
      result = result.filter((p) => {
        const price = Number(p.price);
        return Number.isFinite(price) && price >= band.min && price <= band.max;
      });
    }
  }

  if (filters.rating) {
    const option = RATING_OPTIONS.find((r) => r.id === filters.rating);
    if (option) {
      result = result.filter((p) => Number(p.avgRating) >= option.min);
    }
  }

  if (filters.offer) {
    result = result.filter((p) => discountPercent(p.mrp, p.price) != null);
  }

  if (filters.stock) {
    result = result.filter((p) => !isOutOfStock(p));
  }

  return result;
}

/** Number of rail filters currently active (query is not counted). */
export function countActiveFilters(filters) {
  return FILTER_KEYS.reduce((n, key) => {
    const value = filters[key];
    if (value === "All" || value === "" || value === false || value == null) return n;
    return n + 1;
  }, 0);
}

/**
 * products.js — Product data service.
 *
 * Fetches products from the Supabase `products` table with related data
 * (images, reviews, variants) and maps snake_case DB rows to camelCase
 * frontend objects via `mapDbProduct()`.
 *
 * ### Key functions:
 * - `fetchProducts()` — all active products (for Shop/Home pages)
 * - `fetchProductById(id)` — single product with full reviews
 *   (reads `reviewer_name` directly from `product_reviews`, NOT from `profiles`)
 * - `mapDbProduct(row)` — raw DB row → frontend product object
 *
 * @module services/products
 */
import { supabase } from "./supabase/client";

/**
 * Normalizes the `details` JSONB column into a stable shape so the PDP can
 * render sections without defensive checks. Unknown/missing keys become
 * empty arrays / strings; malformed rows are dropped rather than crashing.
 */
export function normalizeProductDetails(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const str = (v) => (typeof v === "string" ? v : "");
  return {
    benefits: Array.isArray(src.benefits)
      ? src.benefits
        .filter((b) => b && (b.title || b.text))
        .map((b) => ({ icon: str(b.icon) || "general", title: str(b.title), text: str(b.text) }))
      : [],
    ingredients: Array.isArray(src.ingredients)
      ? src.ingredients
        .filter((r) => r && r.name)
        .map((r) => ({ name: str(r.name), amount: str(r.amount), purpose: str(r.purpose) }))
      : [],
    howToUse: Array.isArray(src.howToUse)
      ? src.howToUse.map(str).filter(Boolean)
      : [],
    faqs: Array.isArray(src.faqs)
      ? src.faqs.filter((f) => f && f.q).map((f) => ({ q: str(f.q), a: str(f.a) }))
      : [],
    safetyInfo: str(src.safetyInfo),
  };
}

export function mapDbProduct(p) {
  if (!p) return null;

  const extraImages = Array.isArray(p.product_images)
    ? [...p.product_images]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((img) => img.image_url)
      .filter(Boolean)
    : [];

  const primaryImage = p.image_url ?? "";
  const allImages = primaryImage
    ? [primaryImage, ...extraImages.filter((u) => u !== primaryImage)]
    : extraImages;

  const reviews = Array.isArray(p.product_reviews) ? p.product_reviews : [];
  const reviewCount = reviews.length;
  const avgRating = reviewCount
    ? Math.round((reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviewCount) * 10) / 10
    : null;

  // Map variants — sorted by sort_order
  const variants = Array.isArray(p.product_variants)
    ? [...p.product_variants]
      .filter((v) => v.is_active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((v) => ({
        id: v.id,
        label: v.label,
        price: Number(v.price_inr ?? 0),
        stockQty: Number(v.stock_qty ?? 0),
        sku: v.sku ?? "",
        sortOrder: v.sort_order ?? 0,
        isActive: v.is_active ?? true,
      }))
    : [];

  // Price displayed on card:
  //   - if variants exist → lowest variant price (shop card shows "From ₹X")
  //   - otherwise → base product price
  const basePrice = Number(p.price_inr ?? 0);
  const displayPrice = variants.length > 0
    ? Math.min(...variants.map((v) => v.price))
    : basePrice;

  return {
    id: p.id,
    name: p.name,
    sku: p.sku ?? "",
    category: p.category ?? "",
    description: p.description ?? "",
    price: displayPrice,
    basePrice,
    stockQty: Number(p.stock_qty ?? 0),
    image: primaryImage,
    imagePosition: p.image_position ?? "50% 50%",
    images: allImages,
    isActive: p.is_active ?? true,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    aboutText: p.about_text ?? "",
    bestFor: p.best_for ?? "",
    pairsWellWith: p.pairs_well_with ?? "",
    recommendedStack: p.recommended_stack ?? "",
    highlights: Array.isArray(p.highlights) ? p.highlights : [],
    details: normalizeProductDetails(p.details),
    variants,
    reviewCount,
    avgRating,
  };
}

const PRODUCT_FIELDS =
  "id,name,sku,category,description,price_inr,stock_qty,image_url,image_position,is_active,created_at,updated_at,about_text,best_for,pairs_well_with,recommended_stack,highlights,details,product_images(id,image_url,sort_order),product_reviews(rating),product_variants(id,label,price_inr,stock_qty,sku,sort_order,is_active)";

export async function fetchProducts() {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_FIELDS)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapDbProduct);
}

export async function fetchProductById(id) {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,name,sku,category,description,price_inr,stock_qty,image_url,image_position,is_active,created_at,updated_at,about_text,best_for,pairs_well_with,recommended_stack,highlights,details,product_images(id,image_url,sort_order),product_reviews(id,rating,title,body,created_at,user_id,order_id,reviewer_name),product_variants(id,label,price_inr,stock_qty,sku,sort_order,is_active)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const product = mapDbProduct(data);
  const rawReviews = Array.isArray(data.product_reviews) ? data.product_reviews : [];

  // Use the reviewer_name already stored in product_reviews at write time
  // — no need to query the profiles table (avoids cross-user data leakage)
  product.reviews = [...rawReviews]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title ?? "",
      body: r.body ?? "",
      createdAt: r.created_at,
      userId: r.user_id,
      orderId: r.order_id,
      reviewerName: r.reviewer_name || "Customer",
    }));

  return product;
}

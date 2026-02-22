import { supabase } from "./supabase/client";

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

  return {
    id: p.id,
    name: p.name,
    sku: p.sku ?? "",
    category: p.category ?? "",
    description: p.description ?? "",
    price: Number(p.price_inr ?? 0),
    stockQty: Number(p.stock_qty ?? 0),
    image: primaryImage,
    images: allImages,
    isActive: p.is_active ?? true,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    aboutText: p.about_text ?? "",
    bestFor: p.best_for ?? "",
    pairsWellWith: p.pairs_well_with ?? "",
    recommendedStack: p.recommended_stack ?? "",
    reviewCount,
    avgRating,
  };
}

const PRODUCT_FIELDS =
  "id,name,sku,category,description,price_inr,stock_qty,image_url,is_active,created_at,updated_at,about_text,best_for,pairs_well_with,recommended_stack,product_images(id,image_url,sort_order),product_reviews(rating)";

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
  // Fetch product + images + reviews — NO profiles join (causes schema cache error)
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,name,sku,category,description,price_inr,stock_qty,image_url,is_active,created_at,updated_at,about_text,best_for,pairs_well_with,recommended_stack,product_images(id,image_url,sort_order),product_reviews(id,rating,title,body,created_at,user_id,order_id)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const product = mapDbProduct(data);
  const rawReviews = Array.isArray(data.product_reviews) ? data.product_reviews : [];

  // Fetch reviewer names in a separate query to avoid FK schema issue
  const userIds = [...new Set(rawReviews.map((r) => r.user_id).filter(Boolean))];
  const nameMap = {};
  if (userIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id,full_name")
      .in("id", userIds);
    (profileRows || []).forEach((p) => {
      nameMap[p.id] = p.full_name || "Customer";
    });
  }

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
      reviewerName: nameMap[r.user_id] || "Customer",
    }));

  return product;
}

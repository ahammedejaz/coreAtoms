import { supabase } from "./supabase/client";

// Map DB row -> UI product model
export function mapDbProduct(p) {
  if (!p) return null;
  return {
    id: p.id, // UUID
    name: p.name,
    category: p.category ?? "",
    description: p.description ?? "",
    price: Number(p.price_inr ?? 0),
    stockQty: Number(p.stock_qty ?? 0),
    image: p.image_url ?? "",
    isActive: p.is_active ?? true,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function fetchProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,category,description,price_inr,stock_qty,image_url,is_active,created_at,updated_at")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapDbProduct);
}

export async function fetchProductById(id) {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,category,description,price_inr,stock_qty,image_url,is_active,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return mapDbProduct(data);
}

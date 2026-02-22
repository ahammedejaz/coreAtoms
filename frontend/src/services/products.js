import { supabase } from "./supabase/client";

// Map DB row -> UI product model
export function mapDbProduct(p) {
    if (!p) return null;
    return {
        id: p.id,
        name: p.name,
        category: p.category ?? "",
        description: p.description ?? "",
        price: Number(p.price_inr ?? 0),
        stockQty: Number(p.stock_qty ?? 0),
        image: p.image_url ?? "",
        isActive: p.is_active ?? true,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        aboutText: p.about_text ?? "",
        bestFor: p.best_for ?? "",
        pairsWellWith: p.pairs_well_with ?? "",
        recommendedStack: p.recommended_stack ?? "",
    };
}

const PRODUCT_FIELDS =
    "id,name,category,description,price_inr,stock_qty,image_url,is_active,created_at,updated_at,about_text,best_for,pairs_well_with,recommended_stack";

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
        .select(PRODUCT_FIELDS)
        .eq("id", id)
        .maybeSingle();

    if (error) throw error;
    return mapDbProduct(data);
}
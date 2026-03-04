/**
 * orders.js — Order service layer.
 *
 * Centralizes Supabase queries for orders, reviews, and cancellation,
 * keeping page components thin and improving testability.
 *
 * NOTE: MyOrders.jsx currently uses its own inline Supabase queries
 * with a richer select string. This service is kept for future
 * refactoring — when MyOrders.jsx is migrated to use this layer,
 * update fetchUserOrders to match the full select.
 *
 * @module services/orders
 */
import { supabase } from "./supabase/client";

/**
 * Fetches all orders for a user with their items.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function fetchUserOrders(userId) {
    const { data, error } = await supabase
        .from("orders")
        .select("id,status,created_at,total_amount_inr,total_items,payment_method,razorpay_payment_id,delhivery_waybill,courier_name,tracking_url,shipped_at,delivered_at,coins_credited,coins_used,coins_credit_after,shipping_amount,gst_amount,discount_amount,coupon_code,order_items(id,product_id,product_name,qty,unit_price_inr,line_total_inr,image_url)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Fetches existing reviews by a user (for duplicate checking).
 * @param {string} userId
 * @returns {Promise<Set<string>>} Set of "productId_orderId" keys.
 */
export async function fetchUserReviewKeys(userId) {
    const { data, error } = await supabase
        .from("product_reviews")
        .select("product_id,order_id")
        .eq("user_id", userId);

    if (error) throw error;
    return new Set((data || []).map((r) => `${r.product_id}_${r.order_id}`));
}

/**
 * Cancels an order via the `cancel_order` RPC.
 * @param {string} orderId
 * @param {string} userId
 */
export async function cancelOrder(orderId, userId) {
    const { error } = await supabase.rpc("cancel_order", {
        p_order_id: orderId,
        p_user_id: userId,
    });
    if (error) throw error;
}

/**
 * Submits a product review.
 * @param {{ productId: string, userId: string, orderId: string, rating: number, body?: string, reviewerName?: string }} review
 */
export async function submitReview({ productId, userId, orderId, rating, body, reviewerName }) {
    const { error } = await supabase.from("product_reviews").insert({
        product_id: productId,
        user_id: userId,
        order_id: orderId,
        reviewer_name: reviewerName || "Customer",
        rating,
        title: null,
        body: body?.trim() || null,
    });
    if (error) throw error;
}

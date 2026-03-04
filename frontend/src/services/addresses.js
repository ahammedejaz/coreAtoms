/**
 * addresses.js — Address service layer.
 *
 * Centralizes all Supabase queries related to user addresses,
 * keeping page components thin and improving testability.
 *
 * @module services/addresses
 */
import { supabase } from "./supabase/client";

/**
 * Fetches all saved addresses for a user, ordered most recent first.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function fetchUserAddresses(userId) {
    const { data, error } = await supabase
        .from("user_addresses")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Creates a new saved address for the user.
 * @param {string} userId
 * @param {object} address - { fullName, phone, line1, line2, city, state, pincode }
 * @returns {Promise<object>} The created address row.
 */
export async function createAddress(userId, address) {
    const { data, error } = await supabase
        .from("user_addresses")
        .insert([{
            user_id: userId,
            full_name: address.fullName?.trim(),
            phone: address.phone?.trim(),
            line1: address.line1?.trim(),
            line2: address.line2?.trim(),
            city: address.city?.trim(),
            state: address.state?.trim(),
            pincode: address.pincode?.trim(),
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Deletes a saved address. Includes user_id guard for RLS defense-in-depth.
 * @param {string} addressId
 * @param {string} userId
 */
export async function deleteAddress(addressId, userId) {
    const { error } = await supabase
        .from("user_addresses")
        .delete()
        .eq("id", addressId)
        .eq("user_id", userId);

    if (error) throw error;
}

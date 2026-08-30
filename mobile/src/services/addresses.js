/**
 * addresses.js — Address service layer (mirrors web app).
 */
import { supabase } from './supabase/client';

export async function fetchUserAddresses(userId) {
  const { data, error } = await supabase
    .from('user_addresses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createAddress(userId, address) {
  const { data, error } = await supabase
    .from('user_addresses')
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

export async function updateAddress(addressId, userId, address) {
  const { error } = await supabase
    .from('user_addresses')
    .update({
      full_name: address.fullName?.trim(),
      phone: address.phone?.trim(),
      line1: address.line1?.trim(),
      line2: address.line2?.trim(),
      city: address.city?.trim(),
      state: address.state?.trim(),
      pincode: address.pincode?.trim(),
    })
    .eq('id', addressId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function deleteAddress(addressId, userId) {
  const { error } = await supabase
    .from('user_addresses')
    .delete()
    .eq('id', addressId)
    .eq('user_id', userId);

  if (error) throw error;
}

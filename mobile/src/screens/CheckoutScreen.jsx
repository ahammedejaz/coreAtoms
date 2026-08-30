/**
 * CheckoutScreen — Address selection, payment method, GST, coupons, CoreCoins.
 * Mirrors web Checkout.jsx pricing logic and order flow.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase/client';
import { fetchUserAddresses, createAddress } from '../services/addresses';
import { getAppSettings } from '../services/api/settings';
import { hapticSuccess, hapticError } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING, WAREHOUSE_STATE } from '../constants/theme';
import { money } from '../utils/format';
import RazorpayCheckout from 'react-native-razorpay';

function extractOrderId(payload) {
  if (!payload) return null;
  if (typeof payload === 'string') return payload;
  if (typeof payload === 'number') return String(payload);
  if (typeof payload === 'object') {
    return payload.orderId || payload.order_id || payload.order || payload.id || null;
  }
  return null;
}

export default function CheckoutScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { items, subtotal, clear: clearCart } = useCart();
  const { showToast } = useToast();

  // Addresses
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '',
  });

  // Settings
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [placing, setPlacing] = useState(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState('cod');

  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [couponPercent, setCouponPercent] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);

  // CoreCoins
  const [useCoins, setUseCoins] = useState(false);
  const [coinBalance, setCoinBalance] = useState(0);

  // Pincode shipping
  const [pincodeShipping, setPincodeShipping] = useState(null);

  useEffect(() => {
    loadCheckoutData();
  }, []);

  // Guard: redirect back if cart is empty (e.g. deep link, back-nav after clear)
  useEffect(() => {
    if (!loading && items.length === 0) {
      showToast('Your cart is empty', 'warning');
      navigation.goBack();
    }
  }, [loading, items.length]);

  const loadCheckoutData = async () => {
    try {
      const [addrs, settingsData] = await Promise.all([
        fetchUserAddresses(user.id),
        getAppSettings([
          'gst_percentage', 'shipping_amount', 'free_shipping_min',
          'razorpay_enabled', 'cod_enabled', 'discount_codes',
          'corecoins_enabled', 'corecoins_config', 'warehouse_address',
        ]),
      ]);

      setAddresses(addrs);
      if (addrs.length > 0) setSelectedAddress(addrs[0]);
      setSettings(settingsData);

      // Set default payment method
      const codEnabled = settingsData.cod_enabled?.enabled !== false;
      const rzpEnabled = settingsData.razorpay_enabled?.enabled === true;
      if (!codEnabled && rzpEnabled) setPaymentMethod('prepaid');

      // Fetch CoreCoins balance
      if (settingsData.corecoins_enabled?.enabled) {
        const { data: wallet } = await supabase
          .from('corecoins_wallet')
          .select('balance')
          .eq('user_id', user.id)
          .maybeSingle();
        setCoinBalance(wallet?.balance || 0);
      }
    } catch (err) {
      setLoadError(true);
      showToast('Failed to load checkout data. Please retry.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Pricing Calculations ───────────────────────────────────────
  const gstPercent = settings.gst_percentage?.percentage || 0;
  const flatShipping = Number(settings.shipping_amount?.amount ?? 0);
  const freeShippingMin = Number(settings.free_shipping_min?.amount ?? 0);
  const coinsConfig = settings.corecoins_config || {};
  const coinValueInr = Number(coinsConfig.coin_value_inr || 1);
  const minRedeem = Number(coinsConfig.min_redeem || 100);

  const isFreeShipping = freeShippingMin > 0 && subtotal >= freeShippingMin;

  // Match web logic: pincode rate overrides flat rate when available; flat rate is fallback
  const pincodeRate = pincodeShipping !== null
    ? (paymentMethod === 'cod' ? (pincodeShipping.cod || 0) : (pincodeShipping.prepaid || 0))
    : null;
  const effectiveShippingBase = pincodeRate !== null ? pincodeRate : flatShipping;
  const shippingAmount = isFreeShipping ? 0 : effectiveShippingBase;

  const gstAmount = Math.round(subtotal * gstPercent / 100);
  const couponDiscount = couponApplied ? Math.round(subtotal * couponPercent / 100) : 0;

  // CoreCoins calculation — matches web Checkout.jsx formula exactly
  const canUseCoins = coinsConfig.coin_value_inr && coinBalance >= minRedeem;
  const preCoinsTotal = Math.max(0, subtotal + shippingAmount + gstAmount - couponDiscount);
  const coinsDiscount = (useCoins && canUseCoins) ? Math.min(Math.floor(coinBalance * coinValueInr), preCoinsTotal) : 0;
  const coinsUsed = coinValueInr > 0 ? Math.ceil(coinsDiscount / coinValueInr) : 0;
  const coinDiscount = coinsDiscount;
  const totalAmount = Math.max(0, preCoinsTotal - coinsDiscount);

  // ─── Coupon ─────────────────────────────────────────────────────
  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    const codes = settings.discount_codes || [];
    const match = codes.find(
      (c) => c.code?.toUpperCase() === couponCode.trim().toUpperCase() && c.active
    );
    if (!match) {
      showToast('Invalid or expired coupon code', 'error');
      setCouponPercent(0);
      setCouponApplied(false);
      return;
    }

    // Check schedule
    const now = new Date();
    if (match.startsAt && new Date(match.startsAt) > now) {
      showToast('This coupon is not active yet', 'error');
      return;
    }
    if (match.endsAt && new Date(match.endsAt) < now) {
      showToast('This coupon has expired', 'error');
      return;
    }

    // Check email restriction
    if (match.emails?.length > 0) {
      const userEmail = (user?.email || '').toLowerCase();
      if (!match.emails.map((e) => e.toLowerCase()).includes(userEmail)) {
        showToast('This coupon is not available for your account', 'error');
        return;
      }
    }

    // Check new-users-only restriction
    if (match.newUsersOnly) {
      try {
        const { count } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        if (count > 0) {
          showToast('This coupon is only for first-time customers', 'error');
          return;
        }
      } catch {
        showToast('Failed to validate coupon', 'error');
        return;
      }
    }

    const disc = Number(match.percentage || 0);
    setCouponPercent(disc);
    setCouponApplied(true);
    showToast(`Coupon applied! ${disc}% off`, 'success');
  };

  // ─── Check Pincode Shipping ─────────────────────────────────────
  // Only fetch from Delhivery when admin has NOT set a flat shipping rate
  useEffect(() => {
    if (loading) return; // wait for settings to load first
    const pin = selectedAddress?.pincode;
    if (!pin || pin.length !== 6) return;

    // If admin set flat shipping, skip Delhivery (same as web logic)
    if (flatShipping > 0) {
      setPincodeShipping(null);
      return;
    }

    (async () => {
      try {
        const { data } = await supabase.functions.invoke('delhivery-pincode-check', {
          body: { pincode: pin },
        });
        if (data?.serviceable) {
          setPincodeShipping({
            cod: data.shipping_charge_cod != null ? Math.ceil(Number(data.shipping_charge_cod)) : 0,
            prepaid: data.shipping_charge_prepaid != null ? Math.ceil(Number(data.shipping_charge_prepaid)) : 0,
          });
        } else {
          setPincodeShipping(null);
          showToast('Delivery not available at this pincode', 'warning');
        }
      } catch {
        console.warn('Pincode shipping check failed');
      }
    })();
  }, [selectedAddress?.pincode, loading, flatShipping]);

  const [savingAddress, setSavingAddress] = useState(false);

  // ─── Save New Address ───────────────────────────────────────────
  const handleSaveAddress = async () => {
    const { fullName, phone, line1, city, state, pincode } = newAddress;
    if (!fullName || !phone || !line1 || !city || !state || !pincode) {
      showToast('Please fill all required fields', 'warning');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      showToast('Enter a valid 10-digit phone number', 'warning');
      return;
    }
    if (!/^\d{6}$/.test(pincode)) {
      showToast('Enter a valid 6-digit pincode', 'warning');
      return;
    }

    setSavingAddress(true);
    try {
      const saved = await createAddress(user.id, newAddress);
      setAddresses((prev) => [saved, ...prev]);
      setSelectedAddress(saved);
      setShowNewAddress(false);
      setNewAddress({ fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
      showToast('Address saved!', 'success');
    } catch (err) {
      showToast('Failed to save address', 'error');
    } finally {
      setSavingAddress(false);
    }
  };

  // ─── Place Order ────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      showToast('Please select a delivery address', 'warning');
      return;
    }
    if (items.length === 0) {
      showToast('Your cart is empty', 'warning');
      return;
    }

    setPlacing(true);

    try {
      const orderItems = items.map((item) => ({
        product_id: item.id.includes('_') ? item.id.split('_')[0] : item.id,
        variant_id: item.id.includes('_') ? item.id.split('_')[1] : null,
        product_name: item.name,
        qty: item.qty,
        unit_price_inr: item.unitPrice,
        line_total_inr: item.unitPrice * item.qty,
        image_url: item.image,
      }));

      const addressPayload = {
        full_name: selectedAddress.full_name,
        phone: selectedAddress.phone,
        line1: selectedAddress.line1,
        line2: selectedAddress.line2 || '',
        city: selectedAddress.city,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
      };

      if (paymentMethod === 'cod') {
        const { data, error } = await supabase.rpc('place_order_cod', {
          p_user_id: user.id,
          p_address: addressPayload,
          p_items: orderItems,
          p_coins_used: coinsUsed,
          p_shipping: shippingAmount,
          p_gst: gstAmount,
          p_discount: couponDiscount,
          p_coupon_code: couponApplied ? couponCode.trim().toUpperCase() : null,
        });

        if (error) throw error;

        await clearCart();
        const orderId = extractOrderId(data);
        hapticSuccess();
        showToast('Order placed successfully!', 'success');
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }, { name: 'OrderSuccess', params: {
          orderId,
          receipt: { items, subtotal, gstAmount, shippingAmount, couponDiscount, coinDiscount, totalAmount, paymentMethod: 'cod' },
        } }] });
      } else {
        // Prepaid — create Razorpay order via Edge Function
        const amountInPaise = Math.round(totalAmount * 100);

        const { data: rzpOrder, error: rzpError } = await supabase.functions.invoke('create-razorpay-order', {
          body: { amount: amountInPaise, receipt: `rcpt_${user.id.slice(0, 8)}_${Date.now()}` },
        });

        if (rzpError) throw rzpError;
        if (!rzpOrder?.id) throw new Error('Invalid payment order response');

        // Open Razorpay native checkout
        const rzpKeyId = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;
        if (!rzpKeyId) {
          showToast('Payment configuration error. Please try COD or contact support.', 'error');
          setPlacing(false);
          return;
        }
        const rzpOptions = {
          key: rzpKeyId,
          amount: amountInPaise,
          currency: 'INR',
          name: 'Core Atoms',
          description: `Order — ${items.length} item${items.length > 1 ? 's' : ''}`,
          order_id: rzpOrder.id,
          prefill: {
            name: selectedAddress.full_name,
            email: user.email,
            contact: selectedAddress.phone,
          },
          theme: { color: '#1e3a5f' },
        };

        const paymentResponse = await RazorpayCheckout.open(rzpOptions);

        // Verify payment + create order via Edge Function
        const { data: verifyData, error: verifyErr } = await supabase.functions.invoke(
          'verify-razorpay-payment',
          {
            body: {
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
              user_id: user.id,
              address: addressPayload,
              items: orderItems,
              coins_used: coinsUsed,
              shipping: shippingAmount,
              gst: gstAmount,
              discount: couponDiscount,
              coupon_code: couponApplied ? couponCode.trim().toUpperCase() : null,
            },
          }
        );

        if (verifyErr) {
          let detail = verifyErr.message || 'Payment verification failed';
          if (verifyErr.context && typeof verifyErr.context.json === 'function') {
            try {
              const errBody = await verifyErr.context.json();
              detail = errBody?.error || errBody?.message || detail;
            } catch { }
          }
          // Log failed order so it appears in My Orders
          try {
            await supabase.rpc('log_failed_order', {
              p_user_id: user.id,
              p_address: addressPayload,
              p_items: orderItems,
              p_coins_used: coinsUsed,
              p_shipping: shippingAmount,
              p_gst: gstAmount,
              p_discount: couponDiscount,
              p_coupon_code: couponApplied ? couponCode.trim().toUpperCase() : null,
              p_razorpay_order_id: paymentResponse.razorpay_order_id,
              p_payment_method: 'prepaid',
            });
          } catch { /* fire-and-forget */ }
          throw new Error(detail);
        }

        await clearCart();
        const orderId = extractOrderId(verifyData);
        hapticSuccess();
        showToast('Payment successful! Order placed.', 'success');
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }, { name: 'OrderSuccess', params: {
            orderId,
            receipt: {
              items, subtotal, gstAmount, shippingAmount, couponDiscount, coinDiscount, totalAmount,
              paymentMethod: 'prepaid', razorpayPaymentId: paymentResponse.razorpay_payment_id,
            },
          } }],
        });
      }
    } catch (err) {
      const raw = err?.message || '';
      const lower = String(raw).toLowerCase();
      if (lower.includes('cancel')) {
        showToast('Payment cancelled', 'info');
      } else if (lower.includes('network') || lower.includes('fetch')) {
        showToast('Network error. Please check your connection and try again.', 'error');
      } else if (lower.includes('timeout')) {
        showToast('Request timed out. Please try again.', 'error');
      } else if (raw.length > 100 || lower.includes('rpc') || lower.includes('relation') || lower.includes('column')) {
        showToast('Something went wrong. Please try again or contact support.', 'error');
      } else {
        showToast(raw || 'Failed to place order', 'error');
      }
      hapticError();
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadErrorText}>Failed to load checkout data.</Text>
        <Pressable
          style={styles.retryBtn}
          onPress={() => { setLoadError(false); setLoading(true); loadCheckoutData(); }}
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const codEnabled = settings.cod_enabled?.enabled !== false;
  const rzpEnabled = settings.razorpay_enabled?.enabled === true;
  const coinsEnabled = settings.corecoins_enabled?.enabled && coinBalance >= minRedeem;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Delivery Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          {addresses.map((addr) => (
            <Pressable
              key={addr.id}
              style={[styles.addressCard, selectedAddress?.id === addr.id && styles.addressActive]}
              onPress={() => setSelectedAddress(addr)}
            >
              <View style={styles.radioOuter}>
                {selectedAddress?.id === addr.id && <View style={styles.radioInner} />}
              </View>
              <View style={styles.addressInfo}>
                <Text style={styles.addressName}>{addr.full_name}</Text>
                <Text style={styles.addressLine}>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</Text>
                <Text style={styles.addressLine}>{addr.city}, {addr.state} - {addr.pincode}</Text>
                <Text style={styles.addressPhone}>{addr.phone}</Text>
              </View>
            </Pressable>
          ))}

          <Pressable style={styles.addAddressBtn} onPress={() => setShowNewAddress(!showNewAddress)}>
            <Text style={styles.addAddressText}>{showNewAddress ? 'Cancel' : '+ Add New Address'}</Text>
          </Pressable>

          {showNewAddress && (
            <View style={styles.newAddressForm}>
              {['fullName', 'phone', 'line1', 'line2', 'city', 'state', 'pincode'].map((field) => (
                <View key={field} style={styles.formField}>
                  <Text style={styles.formLabel}>
                    {field === 'fullName' ? 'Full Name' : field === 'line1' ? 'Address Line 1' :
                      field === 'line2' ? 'Address Line 2 (Optional)' : field.charAt(0).toUpperCase() + field.slice(1)}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={newAddress[field]}
                    onChangeText={(t) => setNewAddress({ ...newAddress, [field]: t })}
                    placeholder={field === 'phone' ? '10-digit mobile' : ''}
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType={field === 'phone' || field === 'pincode' ? 'number-pad' : 'default'}
                    maxLength={field === 'pincode' ? 6 : field === 'phone' ? 10 : undefined}
                  />
                </View>
              ))}
              <Pressable
                style={[styles.saveAddressBtn, savingAddress && styles.buttonDisabled]}
                onPress={handleSaveAddress}
                disabled={savingAddress}
              >
                {savingAddress ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.saveAddressBtnText}>Save Address</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentOptions}>
            {codEnabled && (
              <Pressable
                style={[styles.paymentOption, paymentMethod === 'cod' && styles.paymentActive]}
                onPress={() => setPaymentMethod('cod')}
              >
                <View style={styles.radioOuter}>
                  {paymentMethod === 'cod' && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.paymentLabel}>Cash on Delivery</Text>
              </Pressable>
            )}
            {rzpEnabled && (
              <Pressable
                style={[styles.paymentOption, paymentMethod === 'prepaid' && styles.paymentActive]}
                onPress={() => setPaymentMethod('prepaid')}
              >
                <View style={styles.radioOuter}>
                  {paymentMethod === 'prepaid' && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.paymentLabel}>Pay Online (UPI / Card / Netbanking)</Text>
              </Pressable>
            )}
            {!codEnabled && !rzpEnabled && (
              <View style={styles.noPaymentBanner}>
                <Text style={styles.noPaymentText}>
                  No payment methods are currently available. Please contact support.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Coupon */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coupon Code</Text>
          <View style={styles.couponRow}>
            <TextInput
              style={[styles.formInput, { flex: 1 }]}
              value={couponCode}
              onChangeText={(t) => { setCouponCode(t); setCouponApplied(false); setCouponPercent(0); }}
              placeholder="Enter coupon code"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="characters"
              editable={!couponApplied}
            />
            <Pressable
              style={[styles.couponBtn, couponApplied && styles.couponRemoveBtn]}
              onPress={() => {
                if (couponApplied) {
                  setCouponCode('');
                  setCouponPercent(0);
                  setCouponApplied(false);
                } else {
                  applyCoupon();
                }
              }}
            >
              <Text style={styles.couponBtnText}>{couponApplied ? 'Remove' : 'Apply'}</Text>
            </Pressable>
          </View>
        </View>

        {/* CoreCoins */}
        {coinsEnabled && (
          <View style={styles.section}>
            <Pressable style={styles.coinsRow} onPress={() => setUseCoins(!useCoins)}>
              <View style={[styles.checkbox, useCoins && styles.checkboxActive]}>
                {useCoins && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View>
                <Text style={styles.coinsLabel}>Use CoreCoins ({coinBalance} available)</Text>
                <Text style={styles.coinsValue}>Save {money(Math.min(Math.floor(coinBalance * coinValueInr), preCoinsTotal))}</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{money(subtotal)}</Text>
            </View>
            {gstAmount > 0 && (() => {
              const deliveryState = (selectedAddress?.state || '').trim().toLowerCase();
              const warehouseState = (settings.warehouse_address?.state || '').trim().toLowerCase() || WAREHOUSE_STATE;
              const isIntra = deliveryState === warehouseState;
              const halfGstAmt = Math.round(gstAmount / 2);
              return isIntra ? (
                <>
                  <View style={styles.summaryLine}>
                    <Text style={styles.summaryLabel}>CGST ({gstPercent / 2}%)</Text>
                    <Text style={styles.summaryValue}>{money(halfGstAmt)}</Text>
                  </View>
                  <View style={styles.summaryLine}>
                    <Text style={styles.summaryLabel}>SGST ({gstPercent / 2}%)</Text>
                    <Text style={styles.summaryValue}>{money(gstAmount - halfGstAmt)}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.summaryLine}>
                  <Text style={styles.summaryLabel}>IGST ({gstPercent}%)</Text>
                  <Text style={styles.summaryValue}>{money(gstAmount)}</Text>
                </View>
              );
            })()}
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Shipping</Text>
              <Text style={[styles.summaryValue, isFreeShipping && styles.freeText]}>
                {isFreeShipping ? 'FREE' : shippingAmount > 0 ? money(shippingAmount) : 'Calculated'}
              </Text>
            </View>
            {/* Free shipping progress */}
            {freeShippingMin > 0 && !isFreeShipping && subtotal > 0 && (
              <View style={styles.freeShippingProgress}>
                <Text style={styles.freeShippingText}>
                  Add {money(freeShippingMin - subtotal)} more for free shipping!
                </Text>
              </View>
            )}
            {couponDiscount > 0 && (
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Coupon Discount</Text>
                <Text style={[styles.summaryValue, styles.discountText]}>-{money(couponDiscount)}</Text>
              </View>
            )}
            {coinDiscount > 0 && (
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>CoreCoins Discount</Text>
                <Text style={[styles.summaryValue, styles.discountText]}>-{money(coinDiscount)}</Text>
              </View>
            )}
            <View style={[styles.summaryLine, styles.totalLine]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{money(totalAmount)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Place Order Button */}
      <View style={[styles.placeOrderBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.placeOrderBtn, (placing || (!codEnabled && !rzpEnabled)) && styles.buttonDisabled]}
          onPress={handlePlaceOrder}
          disabled={placing || (!codEnabled && !rzpEnabled)}
        >
          {placing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.placeOrderText}>Place Order - {money(totalAmount)}</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  section: { paddingHorizontal: SPACING.lg, marginTop: SPACING.xxl },
  sectionTitle: { ...FONTS.h3, marginBottom: SPACING.md },

  // Address
  addressCard: {
    flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1.5, borderColor: COLORS.border,
  },
  addressActive: { borderColor: COLORS.primary },
  addressInfo: { flex: 1, marginLeft: SPACING.md },
  addressName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  addressLine: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  addressPhone: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },

  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },

  addAddressBtn: { paddingVertical: SPACING.md },
  addAddressText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },

  // New Address Form
  newAddressForm: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginTop: SPACING.sm, ...SHADOWS.sm,
  },
  formField: { marginBottom: SPACING.md },
  formLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  formInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 14, color: COLORS.textPrimary, backgroundColor: COLORS.white,
  },
  saveAddressBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 12, alignItems: 'center', marginTop: SPACING.sm,
  },
  saveAddressBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },

  // Payment
  paymentOptions: { gap: SPACING.md },
  paymentOption: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, borderWidth: 1.5, borderColor: COLORS.border,
  },
  paymentActive: { borderColor: COLORS.primary },
  paymentLabel: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },

  // Coupon
  couponRow: { flexDirection: 'row', gap: SPACING.sm },
  couponBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, justifyContent: 'center',
  },
  couponRemoveBtn: { backgroundColor: COLORS.error },
  couponBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 14 },

  // CoreCoins
  coinsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  checkbox: {
    width: 22, height: 22, borderRadius: RADIUS.sm, borderWidth: 2,
    borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  coinsLabel: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  coinsValue: { fontSize: 12, color: COLORS.success },

  // Summary
  summaryCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, ...SHADOWS.sm,
  },
  summaryLine: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  summaryLabel: { fontSize: 14, color: COLORS.textSecondary },
  summaryValue: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  freeText: { color: COLORS.success, fontWeight: '600' },
  discountText: { color: COLORS.success },
  totalLine: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: SPACING.sm, paddingTop: SPACING.md },
  totalLabel: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  totalValue: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },

  // Free shipping progress
  freeShippingProgress: {
    backgroundColor: '#ecfdf5', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md,
    paddingVertical: 6, marginTop: 4,
  },
  freeShippingText: { fontSize: 12, color: '#059669', fontWeight: '500' },

  // No payment methods
  noPaymentBanner: {
    backgroundColor: '#fef3c7', borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: '#fde68a', padding: SPACING.lg,
  },
  noPaymentText: { fontSize: 13, color: '#92400e', lineHeight: 19 },

  // Place Order
  placeOrderBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.xl, paddingTop: 12, ...SHADOWS.lg,
  },
  placeOrderBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 16, alignItems: 'center',
  },
  placeOrderText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },

  loadErrorText: { fontSize: 15, color: COLORS.textSecondary, marginBottom: SPACING.lg, textAlign: 'center' },
  retryBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xxl, paddingVertical: 12,
  },
  retryBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
});

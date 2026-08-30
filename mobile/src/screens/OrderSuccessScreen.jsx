/**
 * OrderSuccessScreen — Shown after a successful order placement.
 * Displays an itemized receipt card with full breakdown, then
 * auto-redirects to the Orders tab.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { money } from '../utils/format';

const REDIRECT_SECONDS = 12;

export default function OrderSuccessScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const orderId = route?.params?.orderId;
  const receipt = route?.params?.receipt;
  const orderText = typeof orderId === 'string' ? orderId : (orderId ? String(orderId) : null);
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigation.reset({
            index: 0,
            routes: [
              { name: 'MainTabs', params: { screen: 'OrdersTab' } },
            ],
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 30 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Success icon */}
      <View style={styles.iconCircle}>
        <Ionicons name="checkmark-circle" size={56} color={COLORS.success} />
      </View>
      <Text style={styles.title}>Order Placed!</Text>
      <Text style={styles.subtitle}>
        Your order has been placed successfully. You can track it in My Orders.
      </Text>
      {orderText && (
        <Text style={styles.orderId}>Order ID: {orderText.slice(0, 8).toUpperCase()}...</Text>
      )}

      {/* Receipt Card */}
      {receipt && (
        <View style={styles.receiptCard}>
          <View style={styles.receiptHeader}>
            <Ionicons name="receipt-outline" size={18} color={COLORS.primary} />
            <Text style={styles.receiptTitle}>Order Receipt</Text>
          </View>

          {/* Items */}
          {receipt.items?.length > 0 && (
            <View style={styles.itemsSection}>
              {receipt.items.map((item, i) => (
                <View key={item.id || i} style={styles.receiptItem}>
                  <Text style={styles.receiptItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.receiptItemQty}>x{item.qty}</Text>
                  <Text style={styles.receiptItemPrice}>
                    {money(item.unitPrice * item.qty)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Breakdown */}
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Subtotal</Text>
            <Text style={styles.breakdownValue}>{money(receipt.subtotal)}</Text>
          </View>

          {receipt.gstAmount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>GST</Text>
              <Text style={styles.breakdownValue}>{money(receipt.gstAmount)}</Text>
            </View>
          )}

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Shipping</Text>
            <Text style={[styles.breakdownValue, receipt.shippingAmount === 0 && styles.freeText]}>
              {receipt.shippingAmount === 0 ? 'FREE' : money(receipt.shippingAmount)}
            </Text>
          </View>

          {receipt.couponDiscount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Coupon Discount</Text>
              <Text style={[styles.breakdownValue, styles.discountText]}>
                -{money(receipt.couponDiscount)}
              </Text>
            </View>
          )}

          {receipt.coinDiscount > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>CoreCoins</Text>
              <Text style={[styles.breakdownValue, styles.discountText]}>
                -{money(receipt.coinDiscount)}
              </Text>
            </View>
          )}

          {/* Total */}
          <View style={[styles.breakdownRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{money(receipt.totalAmount)}</Text>
          </View>

          {/* Payment method */}
          <View style={styles.paymentBadge}>
            <Ionicons
              name={receipt.paymentMethod === 'cod' ? 'cash-outline' : 'card-outline'}
              size={14}
              color={COLORS.primary}
            />
            <Text style={styles.paymentBadgeText}>
              {receipt.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid Online'}
            </Text>
          </View>

          {receipt.razorpayPaymentId && (
            <Text style={styles.txnId}>
              Transaction ID: {receipt.razorpayPaymentId}
            </Text>
          )}
        </View>
      )}

      <Text style={styles.countdown}>
        Redirecting to My Orders in {countdown}s...
      </Text>

      <Pressable
        style={styles.ordersBtn}
        onPress={() => navigation.reset({
          index: 0,
          routes: [
            { name: 'MainTabs', params: { screen: 'OrdersTab' } },
          ],
        })}
        accessibilityRole="button"
        accessibilityLabel="View my orders"
      >
        <Ionicons name="receipt-outline" size={18} color={COLORS.white} />
        <Text style={styles.ordersBtnText}>View My Orders</Text>
      </Pressable>
      <Pressable
        style={styles.shopBtn}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })}
        accessibilityRole="button"
        accessibilityLabel="Continue shopping"
      >
        <Text style={styles.shopBtnText}>Continue Shopping</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.background },
  container: {
    alignItems: 'center',
    padding: SPACING.xxl,
    paddingTop: 60,
  },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  title: { ...FONTS.h1, marginBottom: SPACING.md },
  subtitle: {
    fontSize: 15, color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: 22, marginBottom: SPACING.lg,
  },
  orderId: { fontSize: 13, color: COLORS.textMuted, marginBottom: SPACING.lg },

  // Receipt Card
  receiptCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    ...SHADOWS.sm,
  },
  receiptHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  receiptTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },

  itemsSection: { gap: 6, marginBottom: SPACING.sm },
  receiptItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  receiptItemName: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
  receiptItemQty: { fontSize: 13, color: COLORS.textMuted, width: 28 },
  receiptItemPrice: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary, textAlign: 'right', minWidth: 65 },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },

  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  breakdownLabel: { fontSize: 13, color: COLORS.textSecondary },
  breakdownValue: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },
  freeText: { color: COLORS.success, fontWeight: '600' },
  discountText: { color: COLORS.success },

  totalRow: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: SPACING.sm, paddingTop: SPACING.md },
  totalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  totalValue: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },

  paymentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary + '10', borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: 'flex-start', marginTop: SPACING.md,
  },
  paymentBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  txnId: {
    fontSize: 11, color: COLORS.textMuted, fontFamily: 'monospace',
    marginTop: SPACING.sm,
  },

  countdown: {
    fontSize: 13, color: COLORS.textMuted, marginBottom: SPACING.xxl,
  },
  ordersBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xxxl, paddingVertical: 14,
    marginBottom: SPACING.md,
  },
  ordersBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
  shopBtn: {
    paddingHorizontal: SPACING.xxxl, paddingVertical: 14,
  },
  shopBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
});

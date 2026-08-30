/**
 * CartScreen — Modern cart with swipe-style item cards, quantity controls.
 */
import React, { useRef } from 'react';
import {
  Animated, FlatList, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { money } from '../utils/format';
import FloatingShapes from '../components/FloatingShapes';

function AnimatedCartItem({ item, index, updateQty, removeItem, maxItems }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(15)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.itemCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Image source={item.image} style={styles.itemImage} contentFit="cover" />
      <View style={styles.itemContent}>
        <View style={styles.itemTop}>
          <View style={styles.itemNameSection}>
            {item.category ? <Text style={styles.itemCategory}>{item.category}</Text> : null}
            <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          </View>
          <Pressable onPress={() => removeItem(item.id)} hitSlop={12} style={styles.removeBtn} accessibilityRole="button" accessibilityLabel={`Remove ${item.name} from cart`}>
            <Ionicons name="close" size={18} color={COLORS.textMuted} />
          </Pressable>
        </View>

        <View style={styles.itemBottom}>
          <View style={styles.qtyControl}>
            <Pressable
              style={styles.qtyBtn}
              onPress={() => item.qty <= 1 ? removeItem(item.id) : updateQty(item.id, item.qty - 1)}
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
            >
              {item.qty <= 1 ? (
                <Ionicons name="trash-outline" size={14} color={COLORS.error} />
              ) : (
                <Ionicons name="remove" size={16} color={COLORS.textPrimary} />
              )}
            </Pressable>
            <Text style={styles.qtyValue}>{item.qty}</Text>
            <Pressable
              style={[styles.qtyBtn, item.qty >= maxItems && { opacity: 0.4 }]}
              onPress={() => updateQty(item.id, Math.min(item.qty + 1, maxItems))}
              disabled={item.qty >= maxItems}
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
            >
              <Ionicons name="add" size={16} color={item.qty >= maxItems ? COLORS.textMuted : COLORS.textPrimary} />
            </Pressable>
          </View>
          <View style={styles.priceColumn}>
            <Text style={styles.itemTotalPrice}>{money(item.unitPrice * item.qty)}</Text>
            {item.qty > 1 && (
              <Text style={styles.itemUnitPrice}>{money(item.unitPrice)} each</Text>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export default function CartScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { items, updateQty, removeItem, totalItems, subtotal, maxItems } = useCart();
  const { isAuthenticated } = useAuth();

  const renderItem = ({ item, index }) => (
    <AnimatedCartItem item={item} index={index} updateQty={updateQty} removeItem={removeItem} maxItems={maxItems} />
  );

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <FloatingShapes />
        <View style={styles.emptyIconCircle}>
          <Ionicons name="bag-outline" size={44} color={COLORS.primary} />
        </View>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtitle}>Discover our products and add them to your cart</Text>
        <Pressable style={styles.shopBtn} onPress={() => navigation.navigate('ShopTab')}>
          <Ionicons name="grid-outline" size={18} color={COLORS.white} />
          <Text style={styles.shopBtnText}>Browse Products</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <FloatingShapes />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.cartHeader}>
            <Text style={styles.cartHeaderText}>{totalItems} item{totalItems !== 1 ? 's' : ''} in your cart</Text>
          </View>
        }
      />

      {/* Bottom Summary */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{money(subtotal)}</Text>
          </View>
          <View style={styles.summaryInfoRow}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.summaryNote}>Shipping, taxes & discounts at checkout</Text>
          </View>
        </View>
        <Pressable
          style={styles.checkoutBtn}
          onPress={() => {
            if (!isAuthenticated) {
              navigation.navigate('Login');
            } else {
              navigation.navigate('Checkout');
            }
          }}
        >
          <Text style={styles.checkoutBtnText}>
            {isAuthenticated ? 'Proceed to Checkout' : 'Sign in to Checkout'}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  listContent: { padding: SPACING.lg },

  cartHeader: { marginBottom: SPACING.md },
  cartHeaderText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },

  itemCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  itemImage: {
    width: 90,
    height: 90,
    borderRadius: RADIUS.md,
    backgroundColor: '#f3f4f6',
  },
  itemContent: { flex: 1, marginLeft: SPACING.md, justifyContent: 'space-between' },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between' },
  itemNameSection: { flex: 1, marginRight: SPACING.sm },
  itemCategory: {
    fontSize: 10, fontWeight: '700', color: COLORS.primary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 19 },
  removeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center',
  },

  itemBottom: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: SPACING.sm,
  },
  qtyControl: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 32, height: 32, justifyContent: 'center', alignItems: 'center',
  },
  qtyValue: {
    fontSize: 14, fontWeight: '700', color: COLORS.textPrimary,
    minWidth: 28, textAlign: 'center',
  },
  priceColumn: { alignItems: 'flex-end' },
  itemTotalPrice: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  itemUnitPrice: { fontSize: 11, color: COLORS.textMuted },

  // Empty
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, padding: SPACING.xxl,
  },
  emptyIconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xl,
  },
  emptyTitle: { ...FONTS.h3, marginBottom: SPACING.sm },
  emptySubtitle: {
    fontSize: 14, color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: 20, marginBottom: SPACING.xxl,
  },
  shopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xxl, paddingVertical: 14,
  },
  shopBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },

  // Summary
  summaryBar: {
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.xl, paddingTop: 12, paddingBottom: 10, ...SHADOWS.lg,
  },
  summaryTop: { marginBottom: SPACING.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { fontSize: 15, fontWeight: '500', color: COLORS.textSecondary },
  summaryValue: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  summaryInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryNote: { fontSize: 12, color: COLORS.textMuted },
  checkoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 15,
  },
  checkoutBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});

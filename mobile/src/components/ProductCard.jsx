/**
 * ProductCard — Matches web Shop.jsx ProductCard layout exactly.
 * Shows: image with category badge + stock badge, name, rating stars,
 * description, highlight tags, variant chips, price with label, and CTA.
 */
import React, { memo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { money } from '../utils/format';

const DEFAULT_HIGHLIGHTS = ['Clean label', 'Lab-tested', 'COD available'];

function Stars({ rating, count }) {
  if (!count) return null;
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={[styles.starChar, i <= Math.round(rating) ? styles.starFilled : styles.starEmpty]}>
          ★
        </Text>
      ))}
      <Text style={styles.starsCount}>
        {Number(rating).toFixed(1)} ({count})
      </Text>
    </View>
  );
}

const ProductCard = memo(function ProductCard({ product, onPress }) {
  const hasVariants = product.variants && product.variants.length > 0;
  const isOutOfStock = (product.stockQty ?? 1) <= 0;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const desc = String(product.description || '').replace(/\s+/g, ' ').trim().slice(0, 110);

  const highlights = product.highlights?.length > 0
    ? product.highlights.slice(0, 3)
    : DEFAULT_HIGHLIGHTS;

  const onPressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} accessibilityRole="button" accessibilityLabel={`View ${product.name}`}>
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        {/* Image section with overlaid badges */}
        <View style={styles.imageContainer}>
          <Image source={product.image} style={styles.image} contentFit="cover" transition={300} cachePolicy="memory-disk" placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} />

          {/* Category badge — top left */}
          {product.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{product.category}</Text>
            </View>
          ) : null}

          {/* Stock badge — top right */}
          <View style={[styles.stockBadge, isOutOfStock ? styles.stockBadgeOut : styles.stockBadgeIn]}>
            <View style={[styles.stockDot, isOutOfStock ? styles.stockDotOut : styles.stockDotIn]} />
            <Text style={[styles.stockBadgeText, isOutOfStock ? styles.stockTextOut : styles.stockTextIn]}>
              {isOutOfStock ? 'Out of stock' : 'In stock'}
            </Text>
          </View>

          {/* Out of stock overlay */}
          {isOutOfStock && (
            <View style={styles.oosOverlay}>
              <Text style={styles.oosText}>Out of Stock</Text>
            </View>
          )}
        </View>

        {/* Body section — mirrors web layout exactly */}
        <View style={styles.body}>
          {/* 1. Name */}
          <Text style={styles.name} numberOfLines={2}>{product.name}</Text>

          {/* 2. Rating — reserves space even when empty */}
          <View style={styles.ratingSpace}>
            {product.reviewCount > 0 && (
              <Stars rating={product.avgRating} count={product.reviewCount} />
            )}
          </View>

          {/* 3. Description */}
          <Text style={styles.desc} numberOfLines={2}>{desc}</Text>

          {/* 4. Highlight tags */}
          <View style={styles.highlightsRow}>
            {highlights.map((tag, i) => (
              <View key={i} style={styles.highlightPill}>
                <Text style={styles.highlightText}>{tag}</Text>
              </View>
            ))}
          </View>

          {/* 5. Price section */}
          <View style={styles.priceSection}>
            <View style={styles.priceLeft}>
              <Text style={styles.priceLabel}>
                {hasVariants ? 'Starting from' : 'Price'}
              </Text>
              <Text style={[styles.price, isOutOfStock && styles.priceOos]}>
                {hasVariants ? `From ${money(product.price)}` : money(product.price)}
              </Text>
              <Text style={styles.priceNote}>Excl. Shipping</Text>
            </View>
            <Text style={styles.detailsLink}>Details →</Text>
          </View>

          {/* 6. Variant chips */}
          {hasVariants && (
            <View style={styles.variantChipsRow}>
              {product.variants.slice(0, 3).map((v) => (
                <View key={v.id} style={styles.variantChip}>
                  <Text style={styles.variantChipText}>{v.label}</Text>
                </View>
              ))}
              {product.variants.length > 3 && (
                <View style={styles.variantChipMore}>
                  <Text style={styles.variantChipMoreText}>+{product.variants.length - 3} more</Text>
                </View>
              )}
            </View>
          )}

          {/* 7. CTA Button */}
          <View style={[styles.ctaBtn, isOutOfStock && styles.ctaBtnDisabled]} accessibilityRole="button" accessibilityLabel={hasVariants ? 'Select option' : isOutOfStock ? 'Out of stock' : 'View Product'}>
            <Text style={[styles.ctaBtnText, isOutOfStock && styles.ctaBtnTextDisabled]}>
              {hasVariants ? 'Select option →' : isOutOfStock ? 'Out of stock' : 'View Product'}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

export default ProductCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.md,
    marginBottom: SPACING.lg,
  },

  // Image
  imageContainer: { position: 'relative' },
  image: {
    width: '100%',
    height: 220,
    backgroundColor: '#f5f5f4',
  },

  // Category badge (top-left on image)
  categoryBadge: {
    position: 'absolute', top: SPACING.sm, left: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
    ...SHADOWS.sm,
  },
  categoryBadgeText: {
    fontSize: 10, fontWeight: '600', color: '#57534e',
  },

  // Stock badge (top-right on image)
  stockBadge: {
    position: 'absolute', top: SPACING.sm, right: SPACING.sm,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1,
  },
  stockBadgeIn: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  stockBadgeOut: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  stockDot: { width: 6, height: 6, borderRadius: 3 },
  stockDotIn: { backgroundColor: '#059669' },
  stockDotOut: { backgroundColor: '#ef4444' },
  stockBadgeText: { fontSize: 10, fontWeight: '600' },
  stockTextIn: { color: '#047857' },
  stockTextOut: { color: '#dc2626' },

  // Out of stock overlay
  oosOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  oosText: {
    color: COLORS.white, fontSize: 14, fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: RADIUS.sm, overflow: 'hidden',
  },

  // Body
  body: { padding: SPACING.lg },

  // Name
  name: {
    fontSize: 15, fontWeight: '600', color: COLORS.textPrimary,
    lineHeight: 21,
  },

  // Rating
  ratingSpace: { height: 20, justifyContent: 'center', marginTop: 6 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  starChar: { fontSize: 13, lineHeight: 16 },
  starFilled: { color: '#fbbf24' },
  starEmpty: { color: '#e7e5e4' },
  starsCount: { fontSize: 11, color: '#a8a29e', marginLeft: 4 },

  // Description
  desc: {
    fontSize: 13, color: '#78716c', lineHeight: 19, marginTop: 8,
  },

  // Highlights
  highlightsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.md,
  },
  highlightPill: {
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: '#fafaf9',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  highlightText: { fontSize: 10, fontWeight: '500', color: '#78716c' },

  // Price section
  priceSection: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingTop: SPACING.lg, marginTop: SPACING.sm,
  },
  priceLeft: {},
  priceLabel: { fontSize: 11, color: '#a8a29e', marginBottom: 2 },
  price: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  priceOos: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  priceNote: { fontSize: 10, color: '#a8a29e', marginTop: 2 },
  detailsLink: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  // Variant chips
  variantChipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.md,
  },
  variantChip: {
    borderWidth: 1, borderColor: 'rgba(30,58,95,0.2)',
    backgroundColor: '#eff6ff',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  variantChipText: { fontSize: 10, fontWeight: '500', color: COLORS.primary },
  variantChipMore: {
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: '#fafaf9',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  variantChipMoreText: { fontSize: 10, color: '#a8a29e' },

  // CTA Button
  ctaBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  ctaBtnDisabled: {
    backgroundColor: '#f5f5f4',
    borderWidth: 1, borderColor: '#e7e5e4',
  },
  ctaBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.white },
  ctaBtnTextDisabled: { color: '#a8a29e' },
});

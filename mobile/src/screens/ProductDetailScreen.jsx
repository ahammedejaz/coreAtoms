/**
 * ProductDetailScreen — Full product page with variants, images, reviews.
 * Modern UI with Ionicons, section cards, and improved layout.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, FlatList, Pressable,
  ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fetchProductById } from '../services/products';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { money } from '../utils/format';
import FloatingShapes from '../components/FloatingShapes';
import { usePincodeCheck } from '../hooks/usePincodeCheck';

export default function ProductDetailScreen({ route, navigation }) {
  const productId = route?.params?.productId;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { addItem } = useCart();
  const { showToast } = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [qty, setQty] = useState(1);

  // Pincode checker — shared hook
  const { pincode, setPincode, result: pincodeResult, checking: checkingPincode, checkPincode } = usePincodeCheck({ showToast });

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const animationRef = useRef(null);

  useEffect(() => {
    if (!productId) {
      showToast('Product not found', 'error');
      navigation.goBack();
      return;
    }
    loadProduct();
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
    };
  }, [productId]);

  const loadProduct = async () => {
    setLoading(true);
    setCurrentImageIndex(0);
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    try {
      const data = await fetchProductById(productId);
      setProduct(data);
      if (data?.variants?.length > 0) {
        // Prefer first in-stock variant, fall back to first variant (matches web logic)
        const firstAvail = data.variants.find((v) => v.stockQty > 0) || data.variants[0];
        setSelectedVariant(firstAvail);
      }
    } catch (err) {
      showToast('Failed to load product', 'error');
    } finally {
      setLoading(false);
      animationRef.current = Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]);
      animationRef.current.start(() => { animationRef.current = null; });
    }
  };

  const currentPrice = selectedVariant ? selectedVariant.price : product?.price || 0;
  const currentStock = selectedVariant ? selectedVariant.stockQty : product?.stockQty || 0;
  const isOutOfStock = currentStock <= 0;

  const handleAddToCart = () => {
    if (!product || isOutOfStock) return;

    const cartProduct = {
      id: selectedVariant ? `${product.id}_${selectedVariant.id}` : product.id,
      name: selectedVariant ? `${product.name} - ${selectedVariant.label}` : product.name,
      price: currentPrice,
      image: product.image,
      category: product.category,
    };

    addItem(cartProduct, qty);
    showToast(`${cartProduct.name} added to cart`, 'success');
  };

  const checkPincodeHandler = () => checkPincode();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Product not found</Text>
      </View>
    );
  }

  const images = product.images?.length > 0
    ? product.images
    : [product.image].filter(Boolean);
  const hasImages = images.length > 0;

  return (
    <View style={styles.container}>
      <FloatingShapes />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 70 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Carousel */}
        <View>
          {hasImages ? (
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => i.toString()}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
              setCurrentImageIndex(index);
            }}
            renderItem={({ item }) => (
              <Image source={item} style={[styles.productImage, { width: screenWidth }]} contentFit="cover" transition={300} cachePolicy="memory-disk" placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} />
            )}
          />
          {images.length > 1 && (
            <View style={styles.dots}>
              {images.map((_, i) => (
                <View key={i} style={[styles.dot, i === currentImageIndex && styles.dotActive]} />
              ))}
            </View>
          )}
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>{currentImageIndex + 1}/{images.length}</Text>
          </View>
          ) : (
            <View style={[styles.productImage, styles.imagePlaceholder, { width: screenWidth }]}>
              <Ionicons name="image-outline" size={64} color={COLORS.border} />
            </View>
          )}
        </View>

        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Category & Name */}
          {product.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{product.category}</Text>
            </View>
          )}
          <Text style={styles.name}>{product.name}</Text>

          {/* Rating */}
          {product.avgRating > 0 && (
            <View style={styles.ratingRow}>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons
                    key={s}
                    name={s <= Math.round(product.avgRating) ? 'star' : 'star-outline'}
                    size={16}
                    color={COLORS.star}
                  />
                ))}
              </View>
              <Text style={styles.ratingText}>
                {product.avgRating} ({product.reviewCount} review{product.reviewCount !== 1 ? 's' : ''})
              </Text>
            </View>
          )}

          {/* Price & Stock */}
          <View style={styles.priceStockRow}>
            <Text style={styles.price}>{money(currentPrice)}</Text>
            <View style={[styles.stockBadge, isOutOfStock ? styles.stockOut : styles.stockIn]}>
              <Ionicons
                name={isOutOfStock ? 'close-circle' : 'checkmark-circle'}
                size={14}
                color={isOutOfStock ? '#dc2626' : '#059669'}
              />
              <Text style={[styles.stockText, isOutOfStock ? styles.stockOutText : styles.stockInText]}>
                {isOutOfStock ? 'Out of Stock' : 'In Stock'}
              </Text>
            </View>
          </View>

          {/* Pincode Checker — at the top for quick delivery check */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location-outline" size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Check Delivery</Text>
            </View>
            <View style={styles.pincodeRow}>
              <TextInput
                style={styles.pincodeInput}
                value={pincode}
                onChangeText={(t) => setPincode(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit pincode"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                maxLength={6}
              />
              <Pressable
                style={[styles.pincodeBtn, checkingPincode && styles.buttonDisabled]}
                onPress={checkPincodeHandler}
                disabled={checkingPincode}
              >
                {checkingPincode ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.pincodeBtnText}>Check</Text>
                )}
              </Pressable>
            </View>
            {pincodeResult && (
              <View style={[styles.pincodeResultBox, pincodeResult.available ? styles.pincodeAvailable : styles.pincodeUnavailable]}>
                <Ionicons
                  name={pincodeResult.available ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={pincodeResult.available ? '#059669' : '#dc2626'}
                />
                <Text style={[styles.pincodeResultText, { color: pincodeResult.available ? '#059669' : '#dc2626' }]}>
                  {pincodeResult.message}
                </Text>
              </View>
            )}
          </View>

          {/* Variants */}
          {product.variants?.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="options-outline" size={18} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Select Variant</Text>
              </View>
              <View style={styles.variantsRow}>
                {product.variants.map((v) => (
                  <Pressable
                    key={v.id}
                    style={[styles.variantChip, selectedVariant?.id === v.id && styles.variantActive]}
                    onPress={() => setSelectedVariant(v)}
                  >
                    <Text style={[styles.variantLabel, selectedVariant?.id === v.id && styles.variantLabelActive]}>
                      {v.label}
                    </Text>
                    <Text style={[styles.variantPrice, selectedVariant?.id === v.id && styles.variantLabelActive]}>
                      {money(v.price)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Quantity */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="layers-outline" size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Quantity</Text>
            </View>
            <View style={styles.qtyRow}>
              <Pressable style={styles.qtyBtn} onPress={() => setQty(Math.max(1, qty - 1))} accessibilityRole="button" accessibilityLabel="Decrease quantity">
                <Ionicons name="remove" size={20} color={COLORS.textPrimary} />
              </Pressable>
              <Text style={styles.qtyValue}>{qty}</Text>
              <Pressable
                style={[styles.qtyBtn, qty >= currentStock && styles.buttonDisabled]}
                onPress={() => setQty(Math.min(qty + 1, Math.max(1, currentStock)))}
                disabled={qty >= currentStock}
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
              >
                <Ionicons name="add" size={20} color={qty >= currentStock ? COLORS.textMuted : COLORS.textPrimary} />
              </Pressable>
            </View>
          </View>

          {/* Description */}
          {product.description && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Description</Text>
              </View>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          )}

          {/* About */}
          {product.aboutText && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>About This Product</Text>
              </View>
              <Text style={styles.description}>{product.aboutText}</Text>
            </View>
          )}

          {/* Highlights */}
          {product.highlights?.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="sparkles-outline" size={18} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Highlights</Text>
              </View>
              {product.highlights.map((h, i) => (
                <View key={i} style={styles.highlightRow}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                  <Text style={styles.highlightText}>{h}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Best For / Pairs Well With / Recommended Stack */}
          {(product.bestFor || product.pairsWellWith || product.recommendedStack) && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="flask-outline" size={18} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Product Info</Text>
              </View>
              {product.bestFor ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxLabel}>Best For</Text>
                  <Text style={styles.infoBoxValue}>{product.bestFor}</Text>
                </View>
              ) : null}
              {product.pairsWellWith ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxLabel}>Pairs Well With</Text>
                  <Text style={styles.infoBoxValue}>{product.pairsWellWith}</Text>
                </View>
              ) : null}
              {product.recommendedStack ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxLabel}>Recommended Stack</Text>
                  <Text style={styles.infoBoxValue}>{product.recommendedStack}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* SKU & Category */}
          <View style={styles.metaRow}>
            {product.category ? (
              <Text style={styles.metaText}>Category: {product.category}</Text>
            ) : null}
            {(selectedVariant?.sku || product.sku) ? (
              <Text style={styles.metaText}>SKU: {selectedVariant?.sku || product.sku}</Text>
            ) : null}
          </View>

          {/* Reviews */}
          {product.reviews?.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="chatbubbles-outline" size={18} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Reviews ({product.reviews.length})</Text>
              </View>
              {product.reviews.slice(0, 5).map((r) => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerInfo}>
                      <View style={styles.reviewerAvatar}>
                        <Text style={styles.reviewerInitial}>
                          {(r.reviewerName || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.reviewerName}>{r.reviewerName}</Text>
                        <Text style={styles.reviewDate}>
                          {new Date(r.createdAt).toLocaleDateString('en-IN')}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.reviewStarsRow}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Ionicons
                          key={s}
                          name={s <= r.rating ? 'star' : 'star-outline'}
                          size={12}
                          color={COLORS.star}
                        />
                      ))}
                    </View>
                  </View>
                  {r.title ? <Text style={styles.reviewTitle}>{r.title}</Text> : null}
                  {r.body ? <Text style={styles.reviewBody}>{r.body}</Text> : null}
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Sticky Add to Cart */}
      <View style={styles.stickyBar}>
        <View style={styles.stickyPrice}>
          <Text style={styles.stickyPriceText}>{money(currentPrice * qty)}</Text>
          <Text style={styles.stickyQty}>{qty} item{qty > 1 ? 's' : ''}</Text>
        </View>
        <Pressable
          style={[styles.addToCartBtn, isOutOfStock && styles.buttonDisabled]}
          onPress={handleAddToCart}
          disabled={isOutOfStock}
        >
          <Ionicons name={isOutOfStock ? 'ban-outline' : 'bag-add-outline'} size={18} color={COLORS.white} />
          <Text style={styles.addToCartText}>{isOutOfStock ? 'Out of Stock' : 'Add to Cart'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  errorText: { fontSize: 16, color: COLORS.textSecondary },

  // Image
  productImage: { height: 340, backgroundColor: COLORS.border },
  imagePlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  dots: { position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.2)' },
  dotActive: { backgroundColor: COLORS.primary, width: 20 },
  imageCounter: {
    position: 'absolute', bottom: 16, right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  imageCounterText: { color: COLORS.white, fontSize: 11, fontWeight: '600' },

  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },

  categoryBadge: {
    alignSelf: 'flex-start', backgroundColor: COLORS.primary + '12',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full,
    marginBottom: SPACING.sm,
  },
  categoryText: {
    fontSize: 11, fontWeight: '700', color: COLORS.primary,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  name: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm, lineHeight: 28 },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  starsRow: { flexDirection: 'row', gap: 2 },
  ratingText: { fontSize: 13, color: COLORS.textSecondary },

  priceStockRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  price: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },

  stockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full,
  },
  stockIn: { backgroundColor: '#ecfdf5' },
  stockOut: { backgroundColor: '#fef2f2' },
  stockInText: { color: '#059669', fontWeight: '600', fontSize: 12 },
  stockOutText: { color: '#dc2626', fontWeight: '600', fontSize: 12 },
  stockText: { fontSize: 12 },

  // Section Cards
  sectionCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },

  // Variants
  variantsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  variantChip: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, alignItems: 'center',
  },
  variantActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  variantLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  variantPrice: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  variantLabelActive: { color: COLORS.white },

  // Qty
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  qtyBtn: {
    width: 40, height: 40, borderRadius: RADIUS.md, borderWidth: 1.5,
    borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  qtyValue: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, minWidth: 30, textAlign: 'center' },

  description: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },

  highlightRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-start' },
  highlightText: { fontSize: 14, color: COLORS.textSecondary, flex: 1, lineHeight: 20 },

  // Pincode
  pincodeRow: { flexDirection: 'row', gap: SPACING.sm },
  pincodeInput: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 10, fontSize: 15, color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },
  pincodeBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, justifyContent: 'center',
  },
  pincodeBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 14 },
  pincodeResultBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: SPACING.sm, paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  pincodeAvailable: { backgroundColor: '#ecfdf5' },
  pincodeUnavailable: { backgroundColor: '#fef2f2' },
  pincodeResultText: { fontSize: 13, fontWeight: '500' },
  buttonDisabled: { opacity: 0.6 },

  // Reviews
  reviewCard: {
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
    paddingBottom: SPACING.md, marginBottom: SPACING.md,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reviewerInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  reviewerAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary + '20',
    justifyContent: 'center', alignItems: 'center',
  },
  reviewerInitial: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  reviewerName: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  reviewDate: { fontSize: 11, color: COLORS.textMuted },
  reviewStarsRow: { flexDirection: 'row', gap: 1 },
  reviewTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  reviewBody: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },

  // Info boxes (Best For / Pairs Well With / Recommended Stack)
  infoBox: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  infoBoxLabel: { fontSize: 11, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoBoxValue: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },

  // Meta
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm, marginBottom: SPACING.sm },
  metaText: { fontSize: 12, color: COLORS.textMuted },

  // Sticky Bar
  stickyBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg,
    paddingTop: 10, paddingBottom: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    ...SHADOWS.lg,
  },
  stickyPrice: { flex: 1 },
  stickyPriceText: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  stickyQty: { fontSize: 12, color: COLORS.textSecondary },
  addToCartBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: 14,
  },
  addToCartText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});

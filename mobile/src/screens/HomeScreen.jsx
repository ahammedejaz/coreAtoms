/**
 * HomeScreen — Landing page with hero, pillars, categories, featured products.
 * Fetches admin-customizable content from app_settings (mirrors web Home.jsx).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, FlatList, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase/client';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import ProductCard from '../components/ProductCard';
import FloatingShapes from '../components/FloatingShapes';
import { useProducts } from '../hooks/useProducts';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';


const DEFAULT_HERO_COPY = {
  headline: 'Engineered for',
  headlineAccent: 'daily consistency.',
  body: 'Modern nutraceuticals designed for real routines. Clean formulas, structured stacks, and a premium experience.',
  primaryCta: 'Shop all products',
  trustIcons: [
    { icon: '🧪', label: 'Clean labels' },
    { icon: '🚚', label: 'COD available' },
    { icon: '📦', label: 'Pan-India delivery' },
  ],
};

const DEFAULT_PILLARS = [
  { icon: '✦', title: 'Clean Labels', desc: 'No fillers, no hidden ingredients.' },
  { icon: '◈', title: 'Lab Tested', desc: 'Third-party verified for potency & purity.' },
  { icon: '⬡', title: 'COD Available', desc: 'Cash on delivery across India.' },
  { icon: '⌖', title: 'Fast Fulfilment', desc: 'Orders dispatched within 24 hours.' },
];

const DEFAULT_CATEGORIES = [
  { label: 'Multivitamins', emoji: '💊', category: 'General Wellness' },
  { label: 'Joint Support', emoji: '🦴', category: 'Joint Support' },
  { label: 'Bone Health', emoji: '🧬', category: 'Bone Health' },
  { label: 'Hair & Skin', emoji: '✨', category: 'HSN' },
  { label: 'Gut Health', emoji: '🌿', category: 'Gut Health' },
  { label: 'Collagen', emoji: '🔬', category: 'Collagen' },
];

const DEFAULT_PHILOSOPHY = {
  label: 'Our Philosophy',
  heading: 'Built like a system,\nnot a trend.',
  body: 'Each Core Atoms formulation is designed around consistency — functional ingredients, simplified stacks, and structured support for real-world routines. No inflated claims. No unnecessary fillers. Just premium precision and daily reliability.',
  cta: 'Explore the range',
};

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const { products: allProducts, loading: loadingProducts, refreshing, onRefresh: refreshProducts } = useProducts();

  const [featuredProducts, setFeaturedProducts] = useState([]);

  const [heroCopy, setHeroCopy] = useState(DEFAULT_HERO_COPY);
  const [pillars, setPillars] = useState(DEFAULT_PILLARS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [heroImages, setHeroImages] = useState([]);
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [promoBanner, setPromoBanner] = useState(null);
  const [philosophy, setPhilosophy] = useState(DEFAULT_PHILOSOPHY);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('key,value')
        .in('key', [
          'homepage_hero_images', 'homepage_hero_copy', 'homepage_pillars',
          'homepage_categories', 'promo_banner', 'homepage_featured_products', 'homepage_philosophy',
        ]);

      const settings = {};
      (data || []).forEach((r) => { settings[r.key] = r.value; });

      // Store featured IDs for product derivation
      const featuredIds = Array.isArray(settings.homepage_featured_products)
        ? settings.homepage_featured_products : [];
      if (featuredIds.length > 0 && allProducts.length > 0) {
        const pinned = featuredIds.map((id) => allProducts.find((p) => p.id === id)).filter(Boolean);
        setFeaturedProducts(pinned.length > 0 ? pinned : allProducts.slice(0, 6));
      } else if (allProducts.length > 0) {
        setFeaturedProducts(allProducts.slice(0, 6));
      }

      if (settings.homepage_hero_copy) setHeroCopy({ ...DEFAULT_HERO_COPY, ...settings.homepage_hero_copy });
      if (Array.isArray(settings.homepage_pillars) && settings.homepage_pillars.length > 0) setPillars(settings.homepage_pillars);
      if (Array.isArray(settings.homepage_categories) && settings.homepage_categories.length > 0) setCategories(settings.homepage_categories);
      if (Array.isArray(settings.homepage_hero_images)) {
        setHeroImages(settings.homepage_hero_images.map((img) =>
          typeof img === 'string' ? { url: img } : img
        ));
      }
      if (settings.promo_banner?.enabled) setPromoBanner(settings.promo_banner);
      if (settings.homepage_philosophy && typeof settings.homepage_philosophy === 'object') {
        setPhilosophy({ ...DEFAULT_PHILOSOPHY, ...settings.homepage_philosophy });
      }
    } catch (err) {
      console.warn('Home settings load error:', err.message);
    } finally {
      setSettingsLoading(false);
    }
  }, [allProducts]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // Derive featured products when allProducts changes (after initial settings load)
  useEffect(() => {
    if (allProducts.length > 0 && featuredProducts.length === 0) {
      setFeaturedProducts(allProducts.slice(0, 6));
    }
  }, [allProducts]);

  // Auto-advance hero carousel
  useEffect(() => {
    if (heroImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % heroImages.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [heroImages.length]);

  const onRefresh = async () => {
    await Promise.all([refreshProducts(), loadSettings()]);
  };

  const navigateToShop = (category) => {
    navigation.navigate('ShopTab', { screen: 'Shop', params: { category } });
  };

  return (
    <View style={styles.container}>
      <FloatingShapes />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
      {/* Promo Banner */}
      {promoBanner && (
        <View style={[styles.promoBanner, { backgroundColor: promoBanner.bgColor || COLORS.primary }]}>
          <Text style={[styles.promoText, { color: promoBanner.textColor || COLORS.white }]}>
            {promoBanner.text}
          </Text>
        </View>
      )}

      {/* Hero Section */}
      <View style={styles.heroSection}>
        {heroImages.length > 0 && (
          <Image
            source={heroImages[currentHeroIndex]?.url}
            style={styles.heroImage}
            contentFit="cover"
            transition={400}
            cachePolicy="memory-disk"
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          />
        )}
        <View style={styles.heroOverlay}>
          <Text style={styles.heroHeadline}>{heroCopy.headline}</Text>
          <Text style={styles.heroAccent}>{heroCopy.headlineAccent}</Text>
          <Text style={styles.heroBody}>{heroCopy.body}</Text>
          <Pressable style={styles.heroCta} onPress={() => navigation.navigate('ShopTab')}>
            <Text style={styles.heroCtaText}>{heroCopy.primaryCta}</Text>
          </Pressable>
        </View>

        {/* Dots */}
        {heroImages.length > 1 && (
          <View style={styles.dots}>
            {heroImages.map((_, i) => (
              <View key={i} style={[styles.dot, i === currentHeroIndex && styles.dotActive]} />
            ))}
          </View>
        )}
      </View>

      {/* Trust Icons */}
      {heroCopy.trustIcons && (
        <View style={styles.trustRow}>
          {heroCopy.trustIcons.map((item, i) => (
            <View key={i} style={styles.trustItem}>
              <Text style={styles.trustIcon}>{item.icon}</Text>
              <Text style={styles.trustLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Pillars */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>WHY CORE ATOMS</Text>
        <View style={styles.pillarsGrid}>
          {pillars.map((p, i) => (
            <View key={i} style={[styles.pillarCard, { width: (screenWidth - SPACING.lg * 2 - SPACING.md) / 2 }]}>
              <Text style={styles.pillarIcon}>{p.icon}</Text>
              <Text style={styles.pillarTitle}>{p.title}</Text>
              <Text style={styles.pillarDesc}>{p.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SHOP BY CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
          {categories.map((cat, i) => (
            <Pressable key={i} style={styles.categoryChip} onPress={() => navigateToShop(cat.category)}>
              <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Featured Products — same layout as Shop page */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>OUR PRODUCTS</Text>
        {loadingProducts ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
        ) : (
          <View>
            {featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onPress={() => navigation.navigate('ProductDetail', { productId: product.id })}
              />
            ))}
          </View>
        )}
      </View>

      {/* Philosophy */}
      <View style={styles.section}>
        <View style={styles.philosophyCard}>
          <Text style={styles.philosophyLabel}>{philosophy.label}</Text>
          <Text style={styles.philosophyHeading}>{philosophy.heading}</Text>
          <Text style={styles.philosophyBody}>{philosophy.body}</Text>
          <Pressable style={styles.philosophyCta} onPress={() => navigation.navigate('ShopTab')}>
            <Text style={styles.philosophyCtaText}>{philosophy.cta}</Text>
          </Pressable>
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Promo Banner
  promoBanner: { paddingVertical: 10, paddingHorizontal: SPACING.lg, alignItems: 'center' },
  promoText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },

  // Hero
  heroSection: { position: 'relative', height: 380, backgroundColor: COLORS.primary },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  heroHeadline: { fontSize: 28, fontWeight: '300', color: COLORS.white },
  heroAccent: { fontSize: 30, fontWeight: '700', color: COLORS.white, marginBottom: SPACING.md },
  heroBody: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20, marginBottom: SPACING.xl },
  heroCta: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 12,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  heroCtaText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  dots: { position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: COLORS.white, width: 20 },

  // Trust
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  trustItem: { alignItems: 'center', gap: 4 },
  trustIcon: { fontSize: 20 },
  trustLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },

  // Section
  section: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xxl },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1.5,
    marginBottom: SPACING.lg,
  },

  // Pillars
  pillarsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  pillarCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  pillarIcon: { fontSize: 22, marginBottom: SPACING.sm },
  pillarTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  pillarDesc: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },

  // Categories
  categoriesScroll: { paddingRight: SPACING.lg, gap: SPACING.md },
  categoryChip: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryEmoji: { fontSize: 18 },
  categoryLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },

  // Philosophy
  philosophyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(232,228,222,0.5)',
    padding: SPACING.xxl,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  philosophyLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.primary,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: SPACING.lg,
  },
  philosophyHeading: {
    fontSize: 22, fontWeight: '600', color: COLORS.textPrimary,
    textAlign: 'center', lineHeight: 30, letterSpacing: -0.3,
    marginBottom: SPACING.lg,
  },
  philosophyBody: {
    fontSize: 14, color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: 22, marginBottom: SPACING.xxl,
  },
  philosophyCta: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: 14,
  },
  philosophyCtaText: {
    color: COLORS.white, fontSize: 14, fontWeight: '600',
  },
});

/**
 * ShopScreen — Product grid with search and category filter.
 * Mirrors web Shop.jsx.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, FlatList, Keyboard, Pressable, RefreshControl,
  StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProducts } from '../hooks/useProducts';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import ProductCard from '../components/ProductCard';
import FloatingShapes from '../components/FloatingShapes';
import { hapticSelection } from '../utils/haptics';



const AnimatedProductItem = React.memo(function AnimatedProductItem({ product, onPress }) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <ProductCard product={product} onPress={onPress} />
    </Animated.View>
  );
});

export default function ShopScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const initialCategory = route?.params?.category || '';

  const { width: screenWidth } = useWindowDimensions();
  const colWidth = (screenWidth - SPACING.lg * 2 - SPACING.md) / 2;
  const { products, loading, refreshing, onRefresh } = useProducts();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const searchTimer = useRef(null);

  // Update category when navigated to with params
  useEffect(() => {
    if (route?.params?.category) setSelectedCategory(route.params.category);
  }, [route?.params?.category]);

  // Debounce search by 300ms
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
    return ['All', ...cats];
  }, [products]);

  const filtered = useMemo(() => {
    // Filter inactive products first (matches web Shop.jsx)
    let result = products.filter((p) => p.isActive !== false);
    if (selectedCategory && selectedCategory !== 'All') {
      result = result.filter((p) => p.category === selectedCategory);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((p) =>
        p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, selectedCategory, debouncedSearch]);

  const renderProduct = ({ item }) => (
    <AnimatedProductItem
      product={item}
      onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
    />
  );

  const ListHeader = () => (
    <View>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search products..."
          placeholderTextColor={COLORS.textMuted}
          returnKeyType="search"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} style={styles.searchClear}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Categories */}
      <FlatList
        horizontal
        data={categories}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
        renderItem={({ item }) => {
          const isActive = (item === 'All' && !selectedCategory) || item === selectedCategory;
          return (
            <Pressable
              style={[styles.categoryChip, isActive && styles.categoryActive]}
              onPress={() => { setSelectedCategory(item === 'All' ? '' : item); hapticSelection(); }}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Filter by ${item}`}
              accessibilityHint={`Shows only ${item === 'All' ? 'all' : item} products`}
            >
              <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                {item}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* Results count */}
      <Text style={styles.resultCount}>{filtered.length} product{filtered.length !== 1 ? 's' : ''}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <FloatingShapes />
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderProduct}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + SPACING.sm, paddingBottom: insets.bottom + 20 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={6}
        windowSize={5}
        initialNumToRender={6}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  listContent: { paddingHorizontal: SPACING.lg },

  searchContainer: {
    marginTop: SPACING.lg, marginBottom: SPACING.md,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, overflow: 'hidden',
    ...SHADOWS.sm,
  },
  searchIcon: { paddingLeft: SPACING.lg },
  searchInput: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  searchClear: { paddingRight: SPACING.md, paddingVertical: 10 },

  categoriesContainer: { paddingVertical: SPACING.sm, gap: SPACING.sm },
  categoryChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryText: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },
  categoryTextActive: { color: COLORS.white },

  resultCount: { fontSize: 12, color: COLORS.textSecondary, marginVertical: SPACING.md },

  productCol: {},

  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15, color: COLORS.textSecondary },
});

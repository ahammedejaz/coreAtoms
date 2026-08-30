/**
 * useProducts — Shared hook for fetching and caching products.
 * Uses stale-while-revalidate: returns cached data immediately,
 * revalidates in background if stale (>60s).
 * Subscribes to Supabase Realtime for live product updates.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchProducts } from '../services/products';
import { supabase } from '../services/supabase/client';

// Module-level cache shared across all hook instances
let cachedProducts = [];
let cacheTimestamp = 0;
const STALE_MS = 60000; // 60 seconds

export function useProducts() {
  const [products, setProducts] = useState(cachedProducts);
  const [loading, setLoading] = useState(cachedProducts.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchProducts();
      cachedProducts = data;
      cacheTimestamp = Date.now();
      setProducts(data);
    } catch (err) {
      setError(err.message);
      console.warn('Failed to fetch products:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If we have fresh cache, skip fetch
    if (cachedProducts.length > 0 && Date.now() - cacheTimestamp < STALE_MS) {
      setProducts(cachedProducts);
      setLoading(false);
      return;
    }
    // If we have stale cache, show it immediately and revalidate
    if (cachedProducts.length > 0) {
      setProducts(cachedProducts);
      setLoading(false);
    }
    load();
  }, [load]);

  // ─── Realtime: auto-refresh when admin updates products ───
  useEffect(() => {
    const channel = supabase
      .channel('products-realtime-mobile')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('[Realtime] Product changed:', payload.eventType, payload.new?.name || payload.old?.id);
          clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            cacheTimestamp = 0; // invalidate cache
            load();
          }, 500);
        }
      )
      .subscribe((status, err) => {
        console.log('[Realtime] Products channel status:', status, err || '');
      });
    return () => {
      clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { products, loading, refreshing, error, onRefresh, reload: load };
}

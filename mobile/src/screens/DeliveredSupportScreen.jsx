import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchUserOrders } from '../services/orders';
import { useAuth } from '../context/AuthContext';
import { COLORS, RADIUS, SHADOWS, SPACING, SUPPORT_WHATSAPP } from '../constants/theme';
import { money } from '../utils/format';
import FloatingShapes from '../components/FloatingShapes';

const DATE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
];

function buildWhatsAppMessage(order) {
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const itemsText = items
    .map((it) => `- ${it.product_name} x${it.qty} (${money(it.line_total_inr)})`)
    .join('\n');

  const lines = [
    'Hi Core Atoms Support, I need help with my delivered order.',
    '',
    `Order ID: ${String(order.id).slice(0, 8).toUpperCase()}`,
    `Order Date: ${new Date(order.created_at).toLocaleString('en-IN')}`,
    `Total Paid: ${money(order.total_amount_inr)}`,
    `Payment Method: ${order.payment_method === 'cod' ? 'COD' : 'Prepaid'}`,
    order.razorpay_payment_id ? `Transaction ID: ${order.razorpay_payment_id}` : null,
    order.delhivery_waybill ? `Original AWB: ${order.delhivery_waybill}` : null,
    '',
    'Items:',
    itemsText || '- NA',
    '',
    'My concern:',
  ].filter(Boolean);

  return encodeURIComponent(lines.join('\n'));
}

export default function DeliveredSupportScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');

  const load = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchUserOrders(user.id);
      setOrders(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const deliveredOrders = useMemo(() => {
    const base = orders.filter((o) => String(o.status || '').toLowerCase() === 'delivered');
    if (dateFilter === 'all') return base;

    const now = new Date();
    if (dateFilter === 'today') {
      return base.filter((o) => {
        const d = new Date(o.delivered_at || o.created_at);
        return d.toDateString() === now.toDateString();
      });
    }

    const days = dateFilter === '7d' ? 7 : 30;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return base.filter((o) => new Date(o.delivered_at || o.created_at) >= cutoff);
  }, [orders, dateFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FloatingShapes />
      <FlatList
        data={deliveredOrders}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={
          <View style={styles.filterWrap}>
            {DATE_FILTERS.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => setDateFilter(f.key)}
                style={[styles.filterChip, dateFilter === f.key && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, dateFilter === f.key && styles.filterTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
        }
        renderItem={({ item }) => {
          const waText = buildWhatsAppMessage(item);
          const waUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${waText}`;

          return (
            <View style={styles.card}>
              <Text style={styles.orderId}>Order ID: {String(item.id).slice(0, 8).toUpperCase()}</Text>
              <Text style={styles.meta}>Delivered on {new Date(item.delivered_at || item.created_at).toLocaleDateString('en-IN')}</Text>
              <Text style={styles.meta}>Total: {money(item.total_amount_inr)}</Text>
              {item.delhivery_waybill ? <Text style={styles.meta}>Original AWB: {item.delhivery_waybill}</Text> : null}

              <Pressable style={styles.supportBtn} onPress={() => Linking.openURL(waUrl)}>
                <Ionicons name="logo-whatsapp" size={16} color={COLORS.white} />
                <Text style={styles.supportBtnText}>Send Enquiry for This Order</Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No delivered orders found.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  listContent: { padding: SPACING.lg, backgroundColor: COLORS.background, flexGrow: 1 },
  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.md },
  filterChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  filterText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  filterTextActive: { color: COLORS.white },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  orderId: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  supportBtn: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
  },
  supportBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },
});
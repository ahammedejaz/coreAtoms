/**
 * OrdersScreen — Order history with status tracking, filters, and reviews.
 * Mirrors web MyOrders.jsx.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Linking, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchUserOrders,
  submitReview,
  fetchUserReviewKeys,
  fetchReplacementSettings,
  fetchUserReplacements,
  requestReplacement,
  fetchShipmentTracking,
} from '../services/orders';
import { supabase } from '../services/supabase/client';
import { getAppSettings } from '../services/api/settings';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING, WAREHOUSE_STATE } from '../constants/theme';
import { money } from '../utils/format';
import FloatingShapes from '../components/FloatingShapes';
import OrderTimeline from '../components/OrderTimeline';
import ShipmentTracker from '../components/ShipmentTracker';

const STATUS_COLORS = {
  placed: '#3b82f6',
  confirmed: '#8b5cf6',
  shipped: '#f59e0b',
  out_for_delivery: '#f97316',
  delivered: '#059669',
  cancelled: '#dc2626',
  payment_failed: '#dc2626',
};

const STATUS_LABELS = {
  placed: 'Order Placed',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  payment_failed: 'Payment Failed',
};

const STATUS_ICONS = {
  placed: 'time-outline',
  confirmed: 'checkmark-circle-outline',
  shipped: 'airplane-outline',
  out_for_delivery: 'bicycle-outline',
  delivered: 'checkmark-done-circle-outline',
  cancelled: 'close-circle-outline',
  payment_failed: 'alert-circle-outline',
};

const REPLACEMENT_REASONS = [
  'Damaged in transit',
  'Wrong product received',
  'Missing items',
  'Defective product',
  'Other',
];

const REPLACEMENT_STATUS_COLORS = {
  pending: '#f59e0b',
  approved: '#059669',
  pickup_scheduled: '#3b82f6',
  pickup_received: '#6366f1',
  replacement_shipped: '#14b8a6',
  rejected: '#dc2626',
};

const REPLACEMENT_STATUS_LABELS = {
  pending: 'Pending Review',
  approved: 'Approved',
  pickup_scheduled: 'Pickup Scheduled',
  pickup_received: 'Pickup Received',
  replacement_shipped: 'Replacement Shipped',
  rejected: 'Rejected',
};

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'placed', label: 'Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];



function getReplacementStatusColor(status) {
  return REPLACEMENT_STATUS_COLORS[status] || COLORS.textMuted;
}

function getLatestTrackingLabel(trackingData, fallbackStatus) {
  if (!trackingData || typeof trackingData !== 'object') {
    return fallbackStatus || 'Status update pending';
  }

  const scans = Array.isArray(trackingData.scans) ? trackingData.scans : [];
  const latestScan = scans.length > 0 ? scans[scans.length - 1] : null;

  return (
    latestScan?.status ||
    trackingData.status ||
    trackingData.current_status ||
    trackingData.shipment_status ||
    fallbackStatus ||
    'Status update pending'
  );
}

function formatLastSynced(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function fetchTrackingWithTimeout(waybill, timeoutMs = 12000) {
  return Promise.race([
    fetchShipmentTracking(waybill),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tracking request timeout')), timeoutMs);
    }),
  ]);
}

export default function OrdersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewKeys, setReviewKeys] = useState(new Set());
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [reviewingItem, setReviewingItem] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [replacementsEnabled, setReplacementsEnabled] = useState(false);
  const [replacementWindowDays, setReplacementWindowDays] = useState(0);
  const [replacementWindowMinutes, setReplacementWindowMinutes] = useState(0);
  const [replacementMap, setReplacementMap] = useState({});
  const [openReplacementForm, setOpenReplacementForm] = useState(null);
  const [replacementReason, setReplacementReason] = useState('');
  const [replacementDescription, setReplacementDescription] = useState('');
  const [submittingReplacement, setSubmittingReplacement] = useState(false);
  const [replacementTrackingMap, setReplacementTrackingMap] = useState({});
  const [replacementTrackingLoading, setReplacementTrackingLoading] = useState({});
  const [reverseTrackingMap, setReverseTrackingMap] = useState({});
  const [reverseTrackingLoading, setReverseTrackingLoading] = useState({});
  const [replacementSyncTimeMap, setReplacementSyncTimeMap] = useState({});
  const [reverseSyncTimeMap, setReverseSyncTimeMap] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [warehouseState, setWarehouseState] = useState(WAREHOUSE_STATE);
  const searchTimerRef = React.useRef(null);

  // CoreCoins state (matches web MyOrders.jsx)
  const [corecoinsEnabled, setCorecoinsEnabled] = useState(false);
  const [coinBalance, setCoinBalance] = useState(0);
  const [corecoinsConfig, setCorecoinsConfig] = useState({ earn_rate: 1, earn_per_rupees: 100, coin_value_inr: 1 });

  const loadOrders = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const [ordersData, keys, replacementSettings, replacements] = await Promise.allSettled([
        fetchUserOrders(user.id),
        fetchUserReviewKeys(user.id),
        fetchReplacementSettings(),
        fetchUserReplacements(user.id),
      ]);

      setOrders(ordersData.status === 'fulfilled' ? (ordersData.value || []) : []);
      setReviewKeys(keys.status === 'fulfilled' ? keys.value : new Set());
      
      if (replacementSettings.status === 'fulfilled') {
        setReplacementsEnabled(replacementSettings.value.enabled);
        setReplacementWindowDays(replacementSettings.value.windowDays);
        setReplacementWindowMinutes(replacementSettings.value.windowMinutes);
      }
      
      if (replacements.status === 'fulfilled') {
        setReplacementMap(replacements.value);
      }

      // Fetch CoreCoins settings and balance (matches web MyOrders.jsx)
      const { data: ccSetting } = await supabase
        .from('app_settings').select('value')
        .eq('key', 'corecoins_enabled').maybeSingle();
      const ccEnabled = ccSetting?.value?.enabled === true;
      setCorecoinsEnabled(ccEnabled);
      if (ccEnabled) {
        const { data: walletData } = await supabase
          .from('corecoins_wallet').select('balance')
          .eq('user_id', user.id).maybeSingle();
        setCoinBalance(Number(walletData?.balance || 0));

        const { data: ccConfig } = await supabase
          .from('app_settings').select('value')
          .eq('key', 'corecoins_config').maybeSingle();
        if (ccConfig?.value) setCorecoinsConfig(ccConfig.value);

        // Credit any pending CoreCoins whose replacement window has now closed
        try {
          await supabase.rpc('process_pending_corecoins', { p_user_id: user.id });
        } catch { /* ignore */ }
        // Re-fetch balance in case coins were just credited
        const { data: freshWallet } = await supabase
          .from('corecoins_wallet').select('balance')
          .eq('user_id', user.id).maybeSingle();
        setCoinBalance(Number(freshWallet?.balance || 0));
      }
    } catch (err) {
      console.warn('Orders load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // ─── Realtime: auto-refresh when admin changes order status ───
  useEffect(() => {
    if (!user?.id) return;
    let debounceTimer = null;
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        (payload) => {
          console.log('[Realtime] Order changed:', payload.eventType, payload.new?.status);
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => loadOrders(), 500);
        }
      )
      .subscribe((status, err) => {
        console.log('[Realtime] Orders channel status:', status, err || '');
      });
    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadOrders]);

  // Fetch warehouse state for GST split
  useEffect(() => {
    (async () => {
      try {
        const s = await getAppSettings(['warehouse_address']);
        const dbState = (s.warehouse_address?.state || '').trim().toLowerCase();
        if (dbState) setWarehouseState(dbState);
      } catch { /* keep constant fallback */ }
    })();
  }, []);

  // Debounce search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery]);

  useEffect(() => {
    const replacement = replacementMap[expandedOrder];
    if (!expandedOrder || !replacement) return;

    let mounted = true;

    const fetchReplacementShipment = async () => {
      if (!replacement.replacement_waybill) return;
      setReplacementTrackingLoading((prev) => {
        if (prev[expandedOrder]) return prev; // already loading, skip
        return { ...prev, [expandedOrder]: true };
      });
      try {
        const data = await fetchTrackingWithTimeout(replacement.replacement_waybill);
        if (!mounted) return;
        setReplacementTrackingMap((prev) => ({ ...prev, [expandedOrder]: data || null }));
        setReplacementSyncTimeMap((prev) => ({ ...prev, [expandedOrder]: Date.now() }));
      } catch {
        if (!mounted) return;
        setReplacementTrackingMap((prev) => ({ ...prev, [expandedOrder]: null }));
      } finally {
        if (!mounted) return;
        setReplacementTrackingLoading((prev) => ({ ...prev, [expandedOrder]: false }));
      }
    };

    const fetchReverseShipment = async () => {
      if (!replacement.reverse_waybill) return;
      setReverseTrackingLoading((prev) => {
        if (prev[expandedOrder]) return prev; // already loading, skip
        return { ...prev, [expandedOrder]: true };
      });
      try {
        const data = await fetchTrackingWithTimeout(replacement.reverse_waybill);
        if (!mounted) return;
        setReverseTrackingMap((prev) => ({ ...prev, [expandedOrder]: data || null }));
        setReverseSyncTimeMap((prev) => ({ ...prev, [expandedOrder]: Date.now() }));
      } catch {
        if (!mounted) return;
        setReverseTrackingMap((prev) => ({ ...prev, [expandedOrder]: null }));
      } finally {
        if (!mounted) return;
        setReverseTrackingLoading((prev) => ({ ...prev, [expandedOrder]: false }));
      }
    };

    fetchReplacementShipment();
    fetchReverseShipment();

    return () => {
      mounted = false;
    };
  }, [expandedOrder, replacementMap]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (statusFilter !== 'all') {
      result = result.filter((o) => o.status === statusFilter);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((o) =>
        String(o.id).toLowerCase().includes(q) ||
        (o.order_items || []).some((item) => item.product_name?.toLowerCase().includes(q)) ||
        (STATUS_LABELS[o.status] || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [orders, statusFilter, debouncedSearch]);

  const handleReview = async (item, orderId) => {
    if (submittingReview) return;
    setSubmittingReview(true);
    try {
      const productId = item.product_id;
      await submitReview({
        productId,
        userId: user.id,
        orderId,
        rating: reviewRating,
        body: reviewBody,
        reviewerName: profile?.full_name || 'Customer',
      });
      showToast('Review submitted!', 'success');
      setReviewingItem(null);
      setReviewRating(5);
      setReviewBody('');
      loadOrders();
    } catch (err) {
      const message = String(err?.message || 'Failed to submit review');
      if (message.toLowerCase().includes('already reviewed') || message.toLowerCase().includes('unique')) {
        showToast('You already reviewed this product.', 'info');
        setReviewKeys((prev) => {
          const next = new Set(prev);
          next.add(`${item.product_id}_${orderId}`);
          return next;
        });
        setReviewingItem(null);
        setReviewBody('');
      } else {
        showToast(message, 'error');
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  const canReview = (order, item) => {
    return order.status === 'delivered' && !reviewKeys.has(`${item.product_id}_${order.id}`);
  };

  const canRequestReplacement = (order) => {
    if (!replacementsEnabled || order.status !== 'delivered') return false;
    if (replacementMap[order.id]) return false; // Already has a replacement request
    
    const deliveredAt = order.delivered_at ? new Date(order.delivered_at) : null;
    if (!deliveredAt) return false;
    
    const totalWindowMs = replacementWindowDays * 24 * 60 * 60 * 1000 + replacementWindowMinutes * 60 * 1000;
    const windowCloseTime = new Date(deliveredAt.getTime() + totalWindowMs);
    return new Date() < windowCloseTime;
  };

  const getReplacementCountdown = (order) => {
    const deliveredAt = order.delivered_at ? new Date(order.delivered_at) : null;
    if (!deliveredAt) return null;
    
    const totalWindowMs = replacementWindowDays * 24 * 60 * 60 * 1000 + replacementWindowMinutes * 60 * 1000;
    const windowCloseTime = new Date(deliveredAt.getTime() + totalWindowMs);
    const now = new Date();
    const diff = windowCloseTime - now;
    
    if (diff <= 0) return null;
    
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const handleRequestReplacement = async (orderId) => {
    if (submittingReplacement) return;
    if (!replacementReason) {
      showToast('Please select a reason', 'warning');
      return;
    }

    setSubmittingReplacement(true);
    try {
      await requestReplacement({
        orderId,
        userId: user.id,
        reason: replacementReason,
        description: replacementDescription,
        imageUrls: [], // Mobile version without image upload for now
      });
      showToast('Replacement request submitted!', 'success');
      setOpenReplacementForm(null);
      setReplacementReason('');
      setReplacementDescription('');
      loadOrders();
    } catch (err) {
      const errorMsg = err.message || 'Failed to submit replacement request';
      showToast(errorMsg, 'error');
    } finally {
      setSubmittingReplacement(false);
    }
  };

  const renderGst = (order) => {
    const gstAmt = order.gst_amount || 0;
    if (gstAmt <= 0) return null;

    const orderState = (order.shipping_address?.state || '').trim().toLowerCase();
    const isIntra = orderState === warehouseState;
    const halfAmt = Math.round(gstAmt / 2);

    if (isIntra) {
      return (
        <>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>CGST</Text>
            <Text style={styles.detailValue}>{money(halfAmt)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>SGST</Text>
            <Text style={styles.detailValue}>{money(gstAmt - halfAmt)}</Text>
          </View>
        </>
      );
    }
    return (
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>IGST</Text>
        <Text style={styles.detailValue}>{money(gstAmt)}</Text>
      </View>
    );
  };

  const renderOrder = ({ item: order }) => {
    const isExpanded = expandedOrder === order.id;
    const statusColor = STATUS_COLORS[order.status] || COLORS.textSecondary;
    const statusIcon = STATUS_ICONS[order.status] || 'ellipse-outline';
    const replacement = replacementMap[order.id];
    const replacementLiveTracking = replacementTrackingMap[order.id];
    const reverseLiveTracking = reverseTrackingMap[order.id];
    const replacementSyncedAt = formatLastSynced(replacementSyncTimeMap[order.id]);
    const reverseSyncedAt = formatLastSynced(reverseSyncTimeMap[order.id]);
    const replacementLiveStatus = getLatestTrackingLabel(
      replacementLiveTracking,
      REPLACEMENT_STATUS_LABELS[replacement?.status] || replacement?.status || 'Status update unavailable'
    );
    const reverseLiveStatus = getLatestTrackingLabel(
      reverseLiveTracking,
      replacement?.status || 'Status update unavailable'
    );

    return (
      <View style={styles.orderCard}>
        {/* Header */}
        <Pressable style={styles.orderHeader} onPress={() => setExpandedOrder(isExpanded ? null : order.id)}>
          <View style={styles.orderHeaderLeft}>
            <Text style={styles.orderIdText}>
              Order ID: <Text style={styles.orderIdValue}>{String(order.id).slice(0, 8).toUpperCase()}</Text>
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
              <Ionicons name={statusIcon} size={14} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {STATUS_LABELS[order.status] || order.status}
              </Text>
            </View>
            <Text style={styles.orderDate}>
              {new Date(order.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.orderHeaderRight}>
            <Text style={styles.orderTotal}>{money(order.total_amount_inr)}</Text>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16} color={COLORS.textMuted}
            />
          </View>
        </Pressable>

        {/* Items Preview */}
        <View style={styles.itemsPreview}>
          {(order.order_items || []).slice(0, 2).map((item) => (
            <View key={item.id} style={styles.previewItem}>
              {item.image_url && (
                <Image source={item.image_url} style={styles.previewImage} contentFit="cover" />
              )}
              <Text style={styles.previewName} numberOfLines={1}>{item.product_name}</Text>
              <Text style={styles.previewQty}>x{item.qty}</Text>
            </View>
          ))}
          {(order.order_items || []).length > 2 && (
            <Text style={styles.moreItems}>+{order.order_items.length - 2} more items</Text>
          )}
        </View>

        {/* Expanded Details */}
        {isExpanded && (
          <View style={styles.expandedSection}>
            {/* Billing */}
            <Text style={styles.billingTitle}>Billing Details</Text>
            <View style={styles.billingCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Subtotal</Text>
                <Text style={styles.detailValue}>
                  {money((order.total_amount_inr || 0) - (order.gst_amount || 0) - (order.shipping_amount || 0) + (order.discount_amount || 0) + ((order.coins_used || 0) * Number(corecoinsConfig?.coin_value_inr || 1)))}
                </Text>
              </View>
              {renderGst(order)}
              {order.shipping_amount > 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Shipping</Text>
                  <Text style={styles.detailValue}>{money(order.shipping_amount)}</Text>
                </View>
              )}
              {order.discount_amount > 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Coupon Discount</Text>
                  <Text style={[styles.detailValue, styles.discountText]}>-{money(order.discount_amount)}</Text>
                </View>
              )}
              {order.coins_used > 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>CoreCoins ({order.coins_used} used)</Text>
                  <Text style={[styles.detailValue, styles.discountText]}>-{money(order.coins_used * Number(corecoinsConfig?.coin_value_inr || 1))}</Text>
                </View>
              )}
              <View style={[styles.detailRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{money(order.total_amount_inr)}</Text>
              </View>
            </View>

            {/* Payment */}
            <View style={styles.infoRow}>
              <Ionicons name="card-outline" size={16} color={COLORS.textSecondary} />
              <Text style={styles.infoText}>
                {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Paid Online'}
              </Text>
            </View>
            {order.payment_method !== 'cod' && order.razorpay_payment_id ? (
              <View style={styles.infoRow}>
                <Ionicons name="receipt-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.infoText}>
                  Transaction ID: <Text style={styles.txnIdValue}>{order.razorpay_payment_id}</Text>
                </Text>
              </View>
            ) : null}

            {/* Payment Failed Banner */}
            {order.status === 'payment_failed' && (
              <View style={styles.paymentFailedBanner}>
                <View style={styles.paymentFailedHeader}>
                  <Ionicons name="alert-circle" size={20} color="#dc2626" />
                  <Text style={styles.paymentFailedTitle}>Payment Failed</Text>
                </View>
                <Text style={styles.paymentFailedSubtitle}>
                  Your payment could not be processed. You can retry or contact support.
                </Text>
                <View style={styles.paymentFailedActions}>
                  <Pressable
                    style={styles.retryPaymentBtn}
                    onPress={() => navigation.navigate('CartTab')}
                  >
                    <Ionicons name="refresh-outline" size={14} color={COLORS.white} />
                    <Text style={styles.retryPaymentText}>Retry Payment</Text>
                  </Pressable>
                  <Pressable
                    style={styles.contactSupportBtn}
                    onPress={() => {
                      const msg = `Hi, I need help with my failed order.\n\nOrder ID: ${String(order.id).slice(0, 8).toUpperCase()}\nDate: ${new Date(order.created_at).toLocaleDateString('en-IN')}\nAmount: ${money(order.total_amount_inr)}`;
                      Linking.openURL(`https://wa.me/919876543210?text=${encodeURIComponent(msg)}`);
                    }}
                  >
                    <Ionicons name="logo-whatsapp" size={14} color={COLORS.primary} />
                    <Text style={styles.contactSupportText}>Contact Support</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {order.status !== 'payment_failed' && (
              <>
                <Text style={styles.itemsTitle}>Order Progress</Text>
                <OrderTimeline status={order.status} />
              </>
            )}

            {order.coins_credited > 0 && (
              <View style={styles.infoRow}>
                <Ionicons name="diamond-outline" size={16} color={COLORS.success} />
                <Text style={[styles.infoText, { color: COLORS.success }]}>
                  +{order.coins_credited} CoreCoins earned
                </Text>
              </View>
            )}
            {/* Pending coins preview — matches web MyOrders.jsx */}
            {corecoinsEnabled && !order.coins_credited && order.status === 'delivered' && (() => {
              const coinVal = Number(corecoinsConfig?.coin_value_inr || 1);
              const earnRate = Number(corecoinsConfig?.earn_rate || 1);
              const earnPerRupees = Number(corecoinsConfig?.earn_per_rupees || 100);
              const netPaid = (order.total_amount_inr || 0) - ((order.coins_used || 0) * coinVal);
              const pending = Math.floor(netPaid * earnRate / earnPerRupees);
              if (pending <= 0) return null;
              return (
                <View style={styles.infoRow}>
                  <Ionicons name="diamond-outline" size={16} color={COLORS.textMuted} />
                  <Text style={[styles.infoText, { color: COLORS.textMuted }]}>
                    {pending} CoreCoins will be added once replacement window closes
                  </Text>
                </View>
              );
            })()}

            {/* Replacement Status or Form */}
            {replacementsEnabled && order.status === 'delivered' && (
              <View style={[styles.sectionCard, { marginTop: SPACING.md, marginBottom: SPACING.md }]}>
                {replacement ? (
                  // Show existing replacement tracking
                  <View>
                    <View style={styles.replacementHeader}>
                      <Ionicons name="swap-horizontal-outline" size={18} color={COLORS.primary} />
                      <Text style={styles.replacementTitle}>Replacement Request</Text>
                    </View>
                    <View style={[styles.replacementStatusBadge, { backgroundColor: `${getReplacementStatusColor(replacement.status)}20` }]}>
                      <View style={[styles.replacementStatusDot, { backgroundColor: getReplacementStatusColor(replacement.status) }]} />
                      <Text style={[styles.replacementStatusText, { color: getReplacementStatusColor(replacement.status) }]}>
                        {REPLACEMENT_STATUS_LABELS[replacement.status] || replacement.status}
                      </Text>
                    </View>
                    <View style={styles.replacementDetailsText}>
                      <Text style={styles.replacementDetailLabel}>Reason: </Text>
                      <Text style={styles.replacementDetailValue}>{replacement.reason}</Text>
                    </View>
                    {replacement.description && (
                      <View style={styles.replacementDetailsText}>
                        <Text style={styles.replacementDetailLabel}>Description:</Text>
                        <Text style={styles.replacementDetailValue}>{replacement.description}</Text>
                      </View>
                    )}
                    {replacement.reverse_waybill ? (
                      <View style={styles.replacementShipmentCard}>
                        <Text style={styles.replacementShipmentAwb}>
                          Reverse Pickup AWB: <Text style={styles.replacementShipmentAwbValue}>{replacement.reverse_waybill}</Text>
                        </Text>
                        <View style={styles.replacementShipmentStatusRow}>
                          <Text style={styles.replacementShipmentStatusText}>
                            Current update: {reverseLiveStatus || 'Update pending'}
                          </Text>
                          {replacement.reverse_tracking_url ? (
                            <Pressable onPress={() => Linking.openURL(replacement.reverse_tracking_url)}>
                              <Text style={styles.replacementTrackInlineLink}>Track Reverse Pickup</Text>
                            </Pressable>
                          ) : null}
                        </View>
                        {reverseTrackingLoading[order.id] ? <Text style={styles.syncHint}>Syncing latest status...</Text> : null}
                        {reverseSyncedAt ? <Text style={styles.syncHint}>Last synced at {reverseSyncedAt}</Text> : null}
                      </View>
                    ) : null}
                    {replacement.replacement_waybill ? (
                      <View style={styles.replacementShipmentCard}>
                        <Text style={styles.replacementShipmentAwb}>
                          AWB: <Text style={styles.replacementShipmentAwbValue}>{replacement.replacement_waybill}</Text>
                        </Text>
                        <View style={styles.replacementShipmentStatusRow}>
                          <Text style={styles.replacementShipmentStatusText}>
                            Current update: {replacementLiveStatus || 'Update pending'}
                          </Text>
                          {replacement.replacement_tracking_url ? (
                            <Pressable onPress={() => Linking.openURL(replacement.replacement_tracking_url)}>
                              <Text style={styles.replacementTrackInlineLink}>Track Replacement Shipment</Text>
                            </Pressable>
                          ) : null}
                        </View>
                        {replacementTrackingLoading[order.id] ? <Text style={styles.syncHint}>Syncing latest status...</Text> : null}
                        {replacementSyncedAt ? <Text style={styles.syncHint}>Last synced at {replacementSyncedAt}</Text> : null}
                      </View>
                    ) : null}
                  </View>
                ) : canRequestReplacement(order) ? (
                  // Show replacement request form
                  <View>
                    <View style={styles.replacementHeader}>
                      <Ionicons name="swap-horizontal-outline" size={18} color={COLORS.primary} />
                      <Text style={styles.replacementTitle}>Request Replacement</Text>
                    </View>
                    {!openReplacementForm || openReplacementForm !== order.id ? (
                      <Pressable
                        style={styles.replacementRequestBtn}
                        onPress={() => setOpenReplacementForm(order.id)}
                      >
                        <Ionicons name="send-outline" size={14} color={COLORS.white} />
                        <Text style={styles.replacementRequestBtnText}>Request Replacement</Text>
                      </Pressable>
                    ) : (
                      // Expanded form
                      <View style={styles.replacementForm}>
                        <Text style={styles.formLabel}>Reason *</Text>
                        <View style={styles.reasonSelect}>
                          {REPLACEMENT_REASONS.map((reason) => (
                            <Pressable
                              key={reason}
                              style={[
                                styles.reasonOption,
                                replacementReason === reason && styles.reasonOptionSelected,
                              ]}
                              onPress={() => setReplacementReason(reason)}
                            >
                              <Ionicons
                                name={replacementReason === reason ? 'radio-button-on' : 'radio-button-off'}
                                size={18}
                                color={replacementReason === reason ? COLORS.primary : COLORS.textMuted}
                              />
                              <Text style={[
                                styles.reasonOptionText,
                                replacementReason === reason && styles.reasonOptionTextSelected,
                              ]}>
                                {reason}
                              </Text>
                            </Pressable>
                          ))}
                        </View>

                        <Text style={[styles.formLabel, { marginTop: SPACING.md }]}>Description (Optional)</Text>
                        <TextInput
                          style={styles.descriptionInput}
                          value={replacementDescription}
                          onChangeText={setReplacementDescription}
                          placeholder="Describe the issue..."
                          placeholderTextColor={COLORS.textMuted}
                          multiline
                          numberOfLines={3}
                        />

                        <View style={styles.replacementFormActions}>
                          <Pressable
                            style={styles.replacementCancelBtn}
                            onPress={() => {
                              setOpenReplacementForm(null);
                              setReplacementReason('');
                              setReplacementDescription('');
                            }}
                          >
                            <Text style={styles.replacementCancelText}>Cancel</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.replacementSubmitBtn, submittingReplacement && styles.buttonDisabled]}
                            onPress={() => handleRequestReplacement(order.id)}
                            disabled={submittingReplacement}
                          >
                            {submittingReplacement ? (
                              <ActivityIndicator color={COLORS.white} size="small" />
                            ) : (
                              <>
                                <Ionicons name="send-outline" size={14} color={COLORS.white} />
                                <Text style={styles.replacementSubmitText}>Submit Request</Text>
                              </>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    )}
                    {getReplacementCountdown(order) && (
                      <View style={styles.countdownInfo}>
                        <Ionicons name="timer-outline" size={12} color={COLORS.textMuted} />
                        <Text style={styles.countdownText}>Closes in {getReplacementCountdown(order)}</Text>
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            )}

            {/* Tracking */}
            {order.delhivery_waybill ? (
              <View style={styles.originalAwbCard}>
                <Text style={styles.originalAwbTitle}>Original Shipment AWB</Text>
                <Text style={styles.originalAwbValue}>{order.delhivery_waybill}</Text>
              </View>
            ) : null}

            {order.tracking_url && (
              <Pressable
                style={styles.trackBtn}
                onPress={() => Linking.openURL(order.tracking_url)}
              >
                <Ionicons name="locate-outline" size={16} color={COLORS.white} />
                <Text style={styles.trackBtnText}>Track Shipment</Text>
              </Pressable>
            )}

            {order.delhivery_waybill ? (
              <ShipmentTracker waybill={order.delhivery_waybill} trackingUrl={order.tracking_url} />
            ) : null}

            {/* All Items */}
            <Text style={styles.itemsTitle}>Items</Text>
            {(order.order_items || []).map((item) => (
              <View key={item.id} style={styles.fullItem}>
                {item.image_url && (
                  <Image source={item.image_url} style={styles.fullItemImage} contentFit="cover" />
                )}
                <View style={styles.fullItemInfo}>
                  <Text style={styles.fullItemName}>{item.product_name}</Text>
                  <Text style={styles.fullItemQty}>Qty: {item.qty} x {money(item.unit_price_inr)}</Text>
                  <Text style={styles.fullItemTotal}>{money(item.line_total_inr)}</Text>
                </View>
                {order.status === 'delivered' && (
                  canReview(order, item) ? (
                    <Pressable
                      style={styles.reviewBtn}
                      onPress={() => setReviewingItem({ ...item, orderId: order.id })}
                    >
                      <Ionicons name="star-outline" size={14} color={COLORS.primary} />
                      <Text style={styles.reviewBtnText}>Review</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.alreadyReviewedBtn}>
                      <Ionicons name="checkmark-circle" size={14} color={COLORS.textMuted} />
                      <Text style={styles.alreadyReviewedText}>Reviewed</Text>
                    </View>
                  )
                )}
              </View>
            ))}

            {/* Review Form */}
            {reviewingItem && reviewingItem.orderId === order.id && (
              <View style={styles.reviewForm}>
                <Text style={styles.reviewFormTitle}>Review: {reviewingItem.product_name}</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable key={star} onPress={() => setReviewRating(star)}>
                      <Ionicons
                        name={star <= reviewRating ? 'star' : 'star-outline'}
                        size={28}
                        color={star <= reviewRating ? COLORS.star : COLORS.border}
                      />
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={styles.reviewInput}
                  value={reviewBody}
                  onChangeText={setReviewBody}
                  placeholder="Write your review (optional)"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={3}
                />
                <View style={styles.reviewActions}>
                  <Pressable
                    style={styles.reviewCancelBtn}
                    onPress={() => { setReviewingItem(null); setReviewBody(''); }}
                  >
                    <Text style={styles.reviewCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.reviewSubmitBtn, submittingReview && styles.buttonDisabled]}
                    onPress={() => handleReview(reviewingItem, reviewingItem.orderId)}
                    disabled={submittingReview}
                  >
                    {submittingReview ? (
                      <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                      <Text style={styles.reviewSubmitText}>Submit Review</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

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
      data={filteredOrders}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderOrder}
      contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View>
          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search orders..."
              placeholderTextColor={COLORS.textMuted}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} style={styles.searchClear}>
                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTER_OPTIONS.map((f) => (
              <Pressable
                key={f.key}
                style={[styles.filterChip, statusFilter === f.key && styles.filterActive]}
                onPress={() => setStatusFilter(f.key)}
              >
                <Text style={[styles.filterText, statusFilter === f.key && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="receipt-outline" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {statusFilter === 'all' ? 'No orders yet' : `No ${statusFilter} orders`}
          </Text>
          <Text style={styles.emptySubtitle}>
            {statusFilter === 'all'
              ? 'Your order history will appear here'
              : 'Try a different filter'}
          </Text>
          {statusFilter === 'all' && (
            <Pressable style={styles.shopBtn} onPress={() => navigation.navigate('ShopTab')}>
              <Text style={styles.shopBtnText}>Start Shopping</Text>
            </Pressable>
          )}
        </View>
      }
    />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  listContent: { padding: SPACING.lg },

  // Search
  searchContainer: {
    marginBottom: SPACING.md,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, overflow: 'hidden',
    ...SHADOWS.sm,
  },
  searchIcon: { paddingLeft: SPACING.lg },
  searchInput: {
    flex: 1, paddingHorizontal: SPACING.sm, paddingVertical: 12,
    fontSize: 15, color: COLORS.textPrimary,
  },
  searchClear: { paddingRight: SPACING.md, paddingVertical: 10 },

  // Filters
  filterRow: { gap: SPACING.sm, paddingBottom: SPACING.lg },
  filterChip: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },
  filterTextActive: { color: COLORS.white },

  orderCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    marginBottom: SPACING.md, overflow: 'hidden', ...SHADOWS.sm,
  },

  orderHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.lg,
  },
  orderHeaderLeft: { gap: 6, flex: 1 },
  orderHeaderRight: { alignItems: 'flex-end', gap: 4 },
  orderIdText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  orderIdValue: { color: COLORS.textSecondary, fontWeight: '700' },
  statusBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
    gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  orderDate: { fontSize: 12, color: COLORS.textMuted },
  orderTotal: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },

  itemsPreview: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: 6 },
  previewItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  previewImage: { width: 36, height: 36, borderRadius: RADIUS.sm, backgroundColor: COLORS.border },
  previewName: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
  previewQty: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  moreItems: { fontSize: 12, color: COLORS.textMuted },

  expandedSection: {
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg,
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.lg,
  },

  // Billing
  billingTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  billingCard: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  detailLabel: { fontSize: 13, color: COLORS.textSecondary },
  detailValue: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },
  discountText: { color: COLORS.success },
  totalRow: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: SPACING.sm, paddingTop: SPACING.sm },
  totalLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  totalValue: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  infoText: { fontSize: 13, color: COLORS.textSecondary },
  txnIdValue: { fontFamily: 'monospace', color: COLORS.textPrimary, fontWeight: '700' },

  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 10, marginTop: SPACING.sm, marginBottom: SPACING.md,
  },
  trackBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },

  itemsTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginTop: SPACING.md, marginBottom: SPACING.sm },
  fullItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  fullItemImage: { width: 52, height: 52, borderRadius: RADIUS.md, backgroundColor: COLORS.border },
  fullItemInfo: { flex: 1 },
  fullItemName: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  fullItemQty: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  fullItemTotal: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },

  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  reviewBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  alreadyReviewedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
  },
  alreadyReviewedText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },

  // Review Form
  reviewForm: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    padding: SPACING.lg, marginTop: SPACING.lg,
  },
  reviewFormTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.md },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: SPACING.md },
  reviewInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 10, fontSize: 14,
    color: COLORS.textPrimary, backgroundColor: COLORS.white,
    minHeight: 80, textAlignVertical: 'top',
  },
  reviewActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md, marginTop: SPACING.md },
  reviewCancelBtn: { paddingHorizontal: SPACING.lg, paddingVertical: 8 },
  reviewCancelText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  reviewSubmitBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: 8,
  },
  reviewSubmitText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },

  // Replacement
  sectionCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, ...SHADOWS.sm,
  },
  replacementHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  replacementTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  replacementStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full,
    marginBottom: SPACING.md,
  },
  replacementStatusDot: { width: 8, height: 8, borderRadius: 4 },
  replacementStatusText: { fontSize: 12, fontWeight: '700' },
  replacementDetailsText: { marginBottom: SPACING.sm },
  replacementDetailLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  replacementDetailValue: { fontSize: 12, color: COLORS.textPrimary, marginTop: 2 },
  replacementShipmentCard: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#f0fdfa',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: 6,
  },
  replacementShipmentAwb: { fontSize: 12, color: '#0f766e', fontWeight: '600' },
  replacementShipmentAwbValue: { fontFamily: 'monospace', fontWeight: '700', color: '#115e59' },
  replacementShipmentStatusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  replacementShipmentStatusText: { fontSize: 12, color: COLORS.textSecondary, flexShrink: 1 },
  replacementTrackInlineLink: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  originalAwbCard: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  originalAwbTitle: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  originalAwbValue: { fontSize: 12, color: COLORS.textPrimary, marginTop: 3, fontFamily: 'monospace', fontWeight: '700' },
  syncHint: { fontSize: 11, color: COLORS.textMuted },
  replacementRequestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 10, marginBottom: SPACING.md,
  },
  replacementRequestBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  replacementForm: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    padding: SPACING.lg, marginBottom: SPACING.md,
  },
  formLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  reasonSelect: { gap: SPACING.sm },
  reasonOption: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  reasonOptionSelected: {},
  reasonOptionText: { fontSize: 13, color: COLORS.textSecondary },
  reasonOptionTextSelected: { color: COLORS.textPrimary, fontWeight: '600' },
  descriptionInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 10, fontSize: 13,
    color: COLORS.textPrimary, backgroundColor: COLORS.white,
    minHeight: 80, textAlignVertical: 'top',
  },
  replacementFormActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md, marginTop: SPACING.md },
  replacementCancelBtn: { paddingHorizontal: SPACING.lg, paddingVertical: 8 },
  replacementCancelText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  replacementSubmitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: 8,
  },
  replacementSubmitText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  countdownInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    alignSelf: 'flex-start',
  },
  countdownText: { fontSize: 11, color: COLORS.textMuted },

  // Payment Failed
  paymentFailedBanner: {
    backgroundColor: '#fef2f2', borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: '#fecaca', padding: SPACING.lg, marginBottom: SPACING.md,
  },
  paymentFailedHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  paymentFailedTitle: { fontSize: 15, fontWeight: '700', color: '#dc2626' },
  paymentFailedSubtitle: { fontSize: 13, color: '#991b1b', lineHeight: 19, marginBottom: SPACING.md },
  paymentFailedActions: { flexDirection: 'row', gap: SPACING.sm },
  retryPaymentBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: 8,
  },
  retryPaymentText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  contactSupportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, paddingHorizontal: SPACING.lg, paddingVertical: 8,
  },
  contactSupportText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#eef2ff',
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.lg,
  },
  emptyTitle: { ...FONTS.h3, marginBottom: SPACING.sm },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: SPACING.xxl },
  shopBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xxxl, paddingVertical: 14,
  },
  shopBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
});

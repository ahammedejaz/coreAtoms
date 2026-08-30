import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchShipmentTracking } from '../services/orders';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

const STAGES = ['placed', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];

function mapStatusToStage(status, statusCode) {
  const s = String(status || '').toLowerCase();
  const c = String(statusCode || '').toUpperCase();

  if (c === 'CN' || c === 'X-PNP' || s.includes('cancel')) return 'cancelled';
  if (c === 'RT' || c === 'RTO' || s.includes('rto') || s.includes('return')) return 'rto';
  if (c === 'DL' || s.includes('delivered')) return 'delivered';
  if (c === 'OT' || s.includes('out for delivery')) return 'out_for_delivery';
  if (c === 'IT' || s.includes('in transit') || s.includes('dispatched')) return 'in_transit';
  if (c === 'PP' || c === 'UD' || s.includes('picked') || s.includes('manifested')) return 'picked_up';
  return 'placed';
}

export default function ShipmentTracker({ waybill, trackingUrl }) {
  const [expanded, setExpanded] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTracking = async () => {
    if (!waybill) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchShipmentTracking(waybill);
      setTracking(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch tracking');
    } finally {
      setLoading(false);
    }
  };

  const onToggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !tracking && !loading && waybill) {
      await fetchTracking();
    }
  };

  const stage = useMemo(
    () => mapStatusToStage(tracking?.status, tracking?.status_code),
    [tracking?.status, tracking?.status_code]
  );

  const stageIndex = STAGES.indexOf(stage);
  const isNegative = stage === 'cancelled' || stage === 'rto';

  return (
    <View style={styles.container}>
      <Pressable style={styles.toggleBtn} onPress={onToggle}>
        <Ionicons name="location-outline" size={14} color={COLORS.primary} />
        <Text style={styles.toggleText}>{expanded ? 'Hide Tracking' : 'Track Status'}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.primary} />
      </Pressable>

      {expanded ? (
        <View style={styles.panel}>
          {loading ? (
            <View style={styles.centerRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.hint}>Fetching tracking details...</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={fetchTracking}><Text style={styles.retry}>Retry</Text></Pressable>
            </View>
          ) : null}

          {tracking && !loading ? (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.meta}>Waybill: {tracking.waybill || waybill}</Text>
                <Text style={styles.meta}>{tracking.courier_name || 'Delhivery'}</Text>
              </View>

              {isNegative ? (
                <View style={styles.negativeBox}>
                  <Text style={styles.negativeText}>{stage === 'cancelled' ? 'Cancelled' : 'Returned (RTO)'}</Text>
                  <Text style={styles.negativeSub}>{tracking.status}</Text>
                </View>
              ) : (
                <View style={styles.progressWrap}>
                  {STAGES.map((k, i) => {
                    const done = i <= stageIndex;
                    return <View key={k} style={[styles.progressDot, done ? styles.progressDotDone : styles.progressDotPending]} />;
                  })}
                </View>
              )}

              <View style={styles.statusBox}>
                <Text style={styles.statusTitle}>{tracking.status || 'Tracking Updated'}</Text>
                {tracking.status_location ? <Text style={styles.hint}>Location: {tracking.status_location}</Text> : null}
                {tracking.status_datetime ? <Text style={styles.hint}>{new Date(tracking.status_datetime).toLocaleString('en-IN')}</Text> : null}
              </View>

              {Array.isArray(tracking.scans) && tracking.scans.length > 0 ? (
                <View style={styles.timelineWrap}>
                  {tracking.scans.slice(-6).reverse().map((scan, idx) => (
                    <View key={`${scan.timestamp || 't'}_${idx}`} style={styles.timelineRow}>
                      <View style={styles.timelineDot} />
                      <View style={styles.timelineTextWrap}>
                        <Text style={styles.timelineTitle}>{scan.status || 'Status update'}</Text>
                        {scan.location ? <Text style={styles.hint}>{scan.location}</Text> : null}
                        {scan.timestamp ? <Text style={styles.time}>{new Date(scan.timestamp).toLocaleString('en-IN')}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {trackingUrl ? (
                <Text style={styles.externalHint}>Delhivery URL: {trackingUrl}</Text>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: SPACING.sm, marginBottom: SPACING.sm },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  toggleText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  panel: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  centerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hint: { color: COLORS.textSecondary, fontSize: 12 },
  errorBox: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  errorText: { color: '#b91c1c', fontSize: 12 },
  retry: { marginTop: 4, color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  meta: { color: COLORS.textMuted, fontSize: 11 },
  negativeBox: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  negativeText: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },
  negativeSub: { color: '#b91c1c', fontSize: 11 },
  progressWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressDot: { width: 10, height: 10, borderRadius: 5 },
  progressDotDone: { backgroundColor: COLORS.success },
  progressDotPending: { backgroundColor: COLORS.border },
  statusBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  statusTitle: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  timelineWrap: { marginTop: 2, gap: 8 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 4 },
  timelineTextWrap: { flex: 1 },
  timelineTitle: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '600' },
  time: { color: COLORS.textMuted, fontSize: 11 },
  externalHint: { color: COLORS.textMuted, fontSize: 10 },
});

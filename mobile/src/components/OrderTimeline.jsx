import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

const STEPS = ['placed', 'shipped', 'out_for_delivery', 'delivered'];

const STEP_LABELS = {
  placed: 'Placed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
};

function mapStatus(status) {
  const s = String(status || 'placed').toLowerCase();
  if (s === 'processing' || s === 'confirmed') return 'placed';
  return s;
}

export default function OrderTimeline({ status }) {
  const mapped = mapStatus(status);
  const isCancelled = mapped === 'cancelled' || mapped === 'payment_failed';

  if (isCancelled) {
    return (
      <View style={styles.cancelledRow}>
        <Ionicons name="close-circle" size={16} color={COLORS.error} />
        <Text style={styles.cancelledText}>{mapped === 'payment_failed' ? 'Payment Failed' : 'Order Cancelled'}</Text>
      </View>
    );
  }

  const currentIndex = Math.max(0, STEPS.indexOf(mapped));

  return (
    <View style={styles.container}>
      {STEPS.map((step, i) => {
        const done = i < currentIndex || (mapped === 'delivered' && i === currentIndex);
        const current = i === currentIndex && mapped !== 'delivered';
        return (
          <View key={step} style={styles.stepWrap}>
            <View style={styles.stepTopRow}>
              <View style={[
                styles.dot,
                done ? styles.dotDone : current ? styles.dotCurrent : styles.dotPending,
              ]}>
                {done ? <Ionicons name="checkmark" size={11} color={COLORS.white} /> : null}
              </View>
              {i < STEPS.length - 1 ? (
                <View style={[
                  styles.connector,
                  i < currentIndex ? styles.connectorDone : styles.connectorPending,
                ]} />
              ) : null}
            </View>
            <Text style={[
              styles.label,
              done ? styles.labelDone : current ? styles.labelCurrent : styles.labelPending,
            ]}>
              {STEP_LABELS[step]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  stepWrap: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  stepTopRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  dotCurrent: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dotPending: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  connector: {
    position: 'absolute',
    left: '50%',
    right: '-50%',
    top: 7,
    height: 2,
  },
  connectorDone: {
    backgroundColor: COLORS.success,
  },
  connectorPending: {
    backgroundColor: COLORS.border,
  },
  label: {
    marginTop: 6,
    fontSize: 10,
    textAlign: 'center',
  },
  labelDone: { color: COLORS.success, fontWeight: '600' },
  labelCurrent: { color: COLORS.primary, fontWeight: '700' },
  labelPending: { color: COLORS.textMuted },
  cancelledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  cancelledText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '700',
  },
});

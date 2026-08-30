/**
 * ToastContext.jsx — Global toast notification system for React Native.
 *
 * Uses React Native's Animated API for smooth enter/exit animations.
 * Renders toasts at the top of the screen.
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';

const ToastContext = createContext(null);

const VARIANT_COLORS = {
  success: COLORS.success,
  error: COLORS.error,
  info: COLORS.info,
  warning: COLORS.warning,
};

function ToastItem({ toast, onDismiss }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  React.useEffect(() => {
    if (toast.exiting) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [toast.exiting]);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: VARIANT_COLORS[toast.variant] || VARIANT_COLORS.info },
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.toastText} numberOfLines={3}>{toast.message}</Text>
      <Pressable onPress={() => onDismiss(toast.id)} hitSlop={8}>
        <Text style={styles.dismissText}>✕</Text>
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const showToast = useCallback((message, variant = 'info', duration = 3000) => {
    const id = ++idRef.current;
    setToasts((prev) => {
      const next = [...prev, { id, message, variant, exiting: false }];
      // Cap at 3 toasts — evict oldest if over limit
      return next.length > 3 ? next.slice(next.length - 3) : next;
    });

    const timerId = setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, duration);

    return () => clearTimeout(timerId);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="box-none">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    gap: 12,
    ...SHADOWS.lg,
  },
  toastText: {
    flex: 1,
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
  },
  dismissText: {
    color: COLORS.white,
    fontSize: 16,
    opacity: 0.7,
  },
});

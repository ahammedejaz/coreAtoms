/**
 * NetworkBanner — Shows a banner when the device is offline.
 * Uses @react-native-community/netinfo under the hood.
 * Falls back gracefully if NetInfo isn't available.
 */
import React, { memo, useCallback, useEffect, useState } from 'react';
import { Animated, AppState, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

/**
 * Lightweight connectivity check using fetch.
 * Works without installing @react-native-community/netinfo.
 */
async function checkConnectivity() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    // Only consider truly offline if the fetch itself failed (network error),
    // not just a slow or non-204 response
    return response != null;
  } catch (err) {
    clearTimeout(timeoutId);
    // AbortError means timeout — treat as still uncertain, not definitively offline
    if (err?.name === 'AbortError') return true;
    return false;
  }
}

const NetworkBanner = memo(function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const opacity = React.useRef(new Animated.Value(0)).current;

  const check = useCallback(async () => {
    const connected = await checkConnectivity();
    setIsOffline(!connected);
  }, []);

  useEffect(() => {
    check();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => {
      subscription?.remove?.();
    };
  }, [check]);

  // When offline, retry every 60s to detect recovery
  useEffect(() => {
    if (!isOffline) return;
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [isOffline, check]);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isOffline ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline]);

  if (!isOffline) return null;

  return (
    <Animated.View style={[styles.banner, { opacity }]}>
      <Ionicons name="cloud-offline-outline" size={16} color={COLORS.white} />
      <Text style={styles.text}>No internet connection</Text>
    </Animated.View>
  );
});

export default NetworkBanner;

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9998,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.error,
    paddingVertical: 8,
    paddingHorizontal: SPACING.lg,
  },
  text: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
});

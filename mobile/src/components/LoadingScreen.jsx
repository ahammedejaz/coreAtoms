/**
 * LoadingScreen — Branded animated loading screen with pulsing CA logo.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { COLORS, SHADOWS } from '../constants/theme';

export default function LoadingScreen() {
  const pulseAnim = useRef(new Animated.Value(0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.85, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoBox, { opacity: fadeAnim, transform: [{ scale: pulseAnim }] }]}>
        <Text style={styles.logoText}>CA</Text>
      </Animated.View>
      <Animated.Text style={[styles.brandName, { opacity: fadeAnim }]}>Core Atoms</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  logoBox: {
    width: 80, height: 80, borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.lg,
  },
  logoText: {
    color: COLORS.white, fontSize: 32, fontWeight: '800', letterSpacing: 1,
  },
  brandName: {
    marginTop: 16, fontSize: 18, fontWeight: '600',
    color: COLORS.textSecondary, letterSpacing: 1,
  },
});

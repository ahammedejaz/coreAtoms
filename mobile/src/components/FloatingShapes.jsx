/**
 * FloatingShapes — Lightweight floating emoji background.
 * Memoized and reduced to 6 emojis for better performance.
 * Should be rendered once in a shared container, not per-screen.
 */
import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';



const ICONS = [
  { emoji: '💊', size: 26 },
  { emoji: '🧪', size: 24 },
  { emoji: '🧬', size: 24 },
  { emoji: '🌿', size: 26 },
  { emoji: '📦', size: 24 },
  { emoji: '✨', size: 22 },
];

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

const FloatingEmoji = memo(function FloatingEmoji({ emoji, size, delay, W, H }) {
  const translateX = useRef(new Animated.Value(randomBetween(20, W - 40))).current;
  const translateY = useRef(new Animated.Value(randomBetween(20, H - 40))).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(opacity, {
      toValue: randomBetween(0.12, 0.22),
      duration: 1000,
      delay,
      useNativeDriver: true,
    }).start();

    // Continuous drift animation — longer durations for less CPU usage
    const driftX = () => {
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: randomBetween(10, W - 50),
          duration: randomBetween(12000, 20000),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: randomBetween(10, W - 50),
          duration: randomBetween(12000, 20000),
          useNativeDriver: true,
        }),
      ]).start(() => driftX());
    };

    const driftY = () => {
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: randomBetween(10, H - 50),
          duration: randomBetween(14000, 22000),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: randomBetween(10, H - 50),
          duration: randomBetween(14000, 22000),
          useNativeDriver: true,
        }),
      ]).start(() => driftY());
    };

    const spin = () => {
      Animated.timing(rotate, {
        toValue: 1,
        duration: randomBetween(25000, 45000),
        useNativeDriver: true,
      }).start(() => {
        rotate.setValue(0);
        spin();
      });
    };

    driftX();
    driftY();
    spin();
  }, []);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.emoji,
        {
          opacity,
          transform: [
            { translateX },
            { translateY },
            { rotate: rotateInterpolate },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </Animated.View>
  );
});

const FloatingShapes = memo(function FloatingShapes() {
  const { width: W, height: H } = useWindowDimensions();
  return (
    <View style={styles.container} pointerEvents="none">
      {ICONS.map((icon, i) => (
        <FloatingEmoji
          key={i}
          emoji={icon.emoji}
          size={icon.size}
          delay={i * 200}
          W={W}
          H={H}
        />
      ))}
    </View>
  );
});

export default FloatingShapes;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    elevation: 0,
  },
  emoji: {
    position: 'absolute',
  },
});

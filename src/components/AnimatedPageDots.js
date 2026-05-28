import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

/**
 * Hybrid animation strategy:
 * - `position` (from the navigator, native thread) drives `opacity` with zero lag.
 *   The dot that becomes active brightens in real-time as you drag your finger.
 * - `animIndex` (local spring, JS thread) drives `width`.
 *   Width isn't native-driver-compatible, so it springs after the swipe completes —
 *   but the brightness change already makes it feel responsive.
 */
export default function AnimatedPageDots({ state, position }) {
  const animIndex = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.spring(animIndex, {
      toValue: state.index,
      useNativeDriver: false,
      overshootClamping: true,
      tension: 220,
      friction: 26,
    }).start();
  }, [state.index]);

  return (
    <View style={styles.container} pointerEvents="none">
      {[0, 1, 2].map((i) => {
        const inputRange = [i - 1, i, i + 1];

        const width = animIndex.interpolate({
          inputRange,
          outputRange: [5, 16, 5],
          extrapolate: 'clamp',
        });

        const opacity = position.interpolate({
          inputRange,
          outputRange: [0.28, 1, 0.28],
          extrapolate: 'clamp',
        });

        // Two separate nodes: outer owns opacity (native driver via position),
        // inner owns width (JS driver via animIndex). They must never share a node.
        return (
          <Animated.View key={i} style={{ opacity }}>
            <Animated.View style={[styles.dot, { width }]} />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#000000',
  },
  dot: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#888888',
  },
});

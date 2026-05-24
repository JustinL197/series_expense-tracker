import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function PageDots({ activeIndex, total = 3 }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    pointerEvents: 'none',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#2A2A2A',
  },
  dotActive: {
    backgroundColor: '#666666',
    width: 16,
    borderRadius: 3,
  },
});

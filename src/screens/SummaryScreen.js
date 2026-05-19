import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/expenses';
import { COLORS } from '../constants';
import { useCategories } from '../context/CategoriesContext';
import CalendarModal from '../components/CalendarModal';

const RANGES = ['day', 'week', 'month'];
const RANGE_LABELS = { day: 'Today', week: 'This Week', month: 'This Month' };

export default function SummaryScreen() {
  const { allCategories } = useCategories();
  const [range, setRange] = useState('month');
  const [showCalendar, setShowCalendar] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!summary) setLoading(true);
    try {
      const data = await api.getSummary(range);
      setSummary(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const getCategoryEmoji = (label) =>
    allCategories.find((c) => c.label === label)?.emoji ?? '';

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Summary</Text>

      <View style={styles.rangeRow}>
        {RANGES.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.rangePill, range === r && styles.rangePillActive]}
            onPress={() => setRange(r)}
          >
            <Text style={[styles.rangePillText, range === r && styles.rangePillTextActive]}>
              {RANGE_LABELS[r]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.text} style={{ marginTop: 60 }} />
      ) : (
        <>
          <View style={styles.totalBlock}>
            <Text style={styles.totalLabel}>{RANGE_LABELS[range]}</Text>
            <Text style={styles.totalAmount}>
              ${summary?.total?.toFixed(2) ?? '0.00'}
            </Text>
            <View style={styles.totalFooter}>
              <Text style={styles.totalCount}>
                {summary?.count ?? 0} expense{summary?.count !== 1 ? 's' : ''}
              </Text>
              {range === 'month' && (
                <TouchableOpacity onPress={() => setShowCalendar(true)}>
                  <Text style={styles.calendarLink}>View Calendar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <CalendarModal visible={showCalendar} onClose={() => setShowCalendar(false)} />

          {summary?.byCategory && Object.keys(summary.byCategory).length > 0 && (
            <View style={styles.breakdown}>
              <Text style={styles.breakdownHeader}>By Category</Text>
              {Object.entries(summary.byCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, amount]) => (
                  <View key={cat} style={styles.breakdownRow}>
                    <Text style={styles.breakdownEmoji}>{getCategoryEmoji(cat)}</Text>
                    <Text style={styles.breakdownLabel}>{cat}</Text>
                    <Text style={styles.breakdownAmount}>${amount.toFixed(2)}</Text>
                  </View>
                ))}
            </View>
          )}
        </>
      )}

      <Text style={styles.hint}>Swipe to add or view expenses →</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 70,
    paddingHorizontal: 24,
  },
  header: {
    color: COLORS.subtext,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 48,
  },
  rangePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.pill,
  },
  rangePillActive: {
    backgroundColor: COLORS.pillActive,
  },
  rangePillText: {
    color: COLORS.subtext,
    fontSize: 13,
  },
  rangePillTextActive: {
    color: COLORS.pillActiveText,
    fontWeight: '600',
  },
  totalBlock: {
    marginBottom: 48,
  },
  totalLabel: {
    color: COLORS.subtext,
    fontSize: 14,
    marginBottom: 8,
  },
  totalAmount: {
    color: COLORS.text,
    fontSize: 56,
    fontWeight: '200',
    letterSpacing: -2,
  },
  totalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  totalCount: {
    color: COLORS.subtext,
    fontSize: 13,
  },
  calendarLink: {
    color: COLORS.text,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 24,
  },
  breakdownHeader: {
    color: COLORS.subtext,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  breakdownEmoji: {
    fontSize: 18,
    marginRight: 12,
  },
  breakdownLabel: {
    color: COLORS.text,
    fontSize: 15,
    flex: 1,
  },
  breakdownAmount: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
  },
  hint: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    color: COLORS.border,
    fontSize: 12,
  },
});

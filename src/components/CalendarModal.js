import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ActivityIndicator, ScrollView, Dimensions,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SHEET_PADDING = 16;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - SHEET_PADDING * 2) / 7);
import { api } from '../api/expenses';
import { COLORS } from '../constants';
import { useCategories } from '../context/CategoriesContext';

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarModal({ visible, onClose }) {
  const { allCategories } = useCategories();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const cache = useRef({});

  const load = useCallback(async () => {
    const key = `${year}-${month}`;
    setSelectedDay(null);

    if (cache.current[key]) {
      setExpenses(cache.current[key]);
      return;
    }

    setLoading(true);
    try {
      const data = await api.getExpensesByMonth(year, month);
      cache.current[key] = data;
      setExpenses(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  // When modal opens, always bust the cache for the current month
  // so newly added expenses show up without restarting the app.
  useEffect(() => {
    if (visible) {
      delete cache.current[`${year}-${month}`];
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  // Group expenses by day number
  const byDay = expenses.reduce((acc, e) => {
    const d = new Date(e.date).getDate();
    if (!acc[d]) acc[d] = [];
    acc[d].push(e);
    return acc;
  }, {});

  const dailyTotal = (day) =>
    (byDay[day] || []).reduce((sum, e) => sum + e.amount, 0);

  // Calendar grid cells
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete the last row
  while (cells.length % 7 !== 0) cells.push(null);

  const goBack = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const goForward = () => {
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
    if (isCurrentMonth) return;
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const selectedExpenses = selectedDay ? (byDay[selectedDay] || []) : [];

  const getCategoryEmoji = (label) =>
    allCategories.find((c) => c.label === label)?.emoji ?? '';

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            >
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Calendar</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Month navigation */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={goBack} style={styles.navBtn}>
                <Text style={styles.navBtnText}>‹</Text>
              </TouchableOpacity>
              <View style={styles.monthLabelRow}>
                <Text style={styles.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
                {loading && (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.subtext}
                    style={{ marginLeft: 8 }}
                  />
                )}
              </View>
              <TouchableOpacity
                onPress={goForward}
                style={styles.navBtn}
                disabled={isCurrentMonth}
              >
                <Text style={[styles.navBtnText, isCurrentMonth && styles.navBtnDisabled]}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={styles.dayHeaders}>
              {DAY_HEADERS.map((d) => (
                <Text key={d} style={styles.dayHeaderText}>{d}</Text>
              ))}
            </View>

            {/* Grid — always rendered so layout never jumps; amounts appear once loaded */}
            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (!day) return <View key={`empty-${i}`} style={styles.cell} />;
                const total = dailyTotal(day);
                const isToday =
                  day === today.getDate() &&
                  month === today.getMonth() &&
                  year === today.getFullYear();
                const isSelected = selectedDay === day;
                const hasSpend = !loading && total > 0;

                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.cell,
                      isSelected && styles.cellSelected,
                      isToday && !isSelected && styles.cellToday,
                    ]}
                    onPress={() => setSelectedDay(isSelected ? null : day)}
                    disabled={!hasSpend}
                  >
                    <Text style={[
                      styles.cellDay,
                      isSelected && styles.cellDaySelected,
                      isToday && !isSelected && styles.cellDayToday,
                      !hasSpend && styles.cellDayEmpty,
                    ]}>
                      {day}
                    </Text>
                    {hasSpend && (
                      <Text style={[styles.cellAmount, isSelected && styles.cellAmountSelected]}>
                        ${total % 1 === 0 ? total : total.toFixed(0)}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selected day transactions */}
            {selectedDay && (
              <View style={styles.dayDetail}>
                <Text style={styles.dayDetailHeader}>
                  {MONTH_NAMES[month]} {selectedDay}
                </Text>
                {selectedExpenses.map((e) => (
                  <View key={e.id} style={styles.txRow}>
                    <View style={styles.txLeft}>
                      {getCategoryEmoji(e.category) ? (
                        <Text style={styles.txEmoji}>{getCategoryEmoji(e.category)}</Text>
                      ) : null}
                      <View>
                        <Text style={styles.txTitle}>{e.title}</Text>
                        <Text style={styles.txMeta}>{e.category} · {formatTime(e.date)}</Text>
                      </View>
                    </View>
                    <Text style={styles.txAmount}>${e.amount.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 48,
    maxHeight: '92%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  closeBtn: {
    color: COLORS.subtext,
    fontSize: 18,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    color: COLORS.text,
    fontSize: 28,
    lineHeight: 32,
  },
  navBtnDisabled: {
    color: COLORS.border,
  },
  monthLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthLabel: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '600',
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeaderText: {
    width: CELL_SIZE,
    textAlign: 'center',
    color: COLORS.subtext,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: CELL_SIZE * 6,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  cellSelected: {
    backgroundColor: COLORS.text,
  },
  cellToday: {
    borderWidth: 1,
    borderColor: COLORS.subtext,
  },
  cellDay: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '400',
  },
  cellDaySelected: {
    color: COLORS.background,
    fontWeight: '600',
  },
  cellDayToday: {
    fontWeight: '600',
  },
  cellDayEmpty: {
    color: '#333',
  },
  cellAmount: {
    color: COLORS.subtext,
    fontSize: 9,
    marginTop: 2,
  },
  cellAmountSelected: {
    color: COLORS.background,
  },
  dayDetail: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 20,
  },
  dayDetailHeader: {
    color: COLORS.subtext,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  txEmoji: {
    fontSize: 20,
  },
  txTitle: {
    color: COLORS.text,
    fontSize: 15,
    marginBottom: 2,
  },
  txMeta: {
    color: COLORS.subtext,
    fontSize: 12,
  },
  txAmount: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
  },
});

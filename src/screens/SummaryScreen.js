import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { api, localRangeBounds } from '../api/expenses';
import { COLORS } from '../constants';
import { useCategories } from '../context/CategoriesContext';
import CalendarModal from '../components/CalendarModal';

const RANGES = ['day', 'week', 'month'];
const RANGE_LABELS = { day: 'Today', week: 'This Week', month: 'This Month' };
const BUDGET_LABELS = { day: 'daily', week: 'weekly', month: 'monthly' };
const BUDGET_KEYS = { day: 'budget_day', week: 'budget_week', month: 'budget_month' };

export default function SummaryScreen() {
  const insets = useSafeAreaInsets();
  const { allCategories } = useCategories();
  const [range, setRange] = useState('month');
  const [showCalendar, setShowCalendar] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState({ day: null, week: null, month: null });
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  useEffect(() => {
    Promise.all(
      RANGES.map((r) => AsyncStorage.getItem(BUDGET_KEYS[r]))
    ).then(([day, week, month]) => {
      setBudgets({
        day: day ? parseFloat(day) : null,
        week: week ? parseFloat(week) : null,
        month: month ? parseFloat(month) : null,
      });
    });
  }, []);

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

  const currentBudget = budgets[range];
  const spent = summary?.total ?? 0;
  const diff = currentBudget != null ? currentBudget - spent : null;
  const progress = currentBudget ? Math.min(spent / currentBudget, 1) : 0;
  const isOver = diff != null && diff < 0;

  const openBudgetModal = () => {
    setBudgetInput(currentBudget ? String(currentBudget) : '');
    setShowBudgetModal(true);
  };

  const saveBudget = async () => {
    if (!budgetInput.trim()) {
      setBudgets((prev) => ({ ...prev, [range]: null }));
      await AsyncStorage.removeItem(BUDGET_KEYS[range]);
      setShowBudgetModal(false);
      return;
    }
    const val = parseFloat(budgetInput);
    if (!val || val <= 0) return;
    setBudgets((prev) => ({ ...prev, [range]: val }));
    await AsyncStorage.setItem(BUDGET_KEYS[range], String(val));
    setShowBudgetModal(false);
    setBudgetInput('');
  };

  const budgetInputRef = useRef(null);
  const [catModal, setCatModal] = useState({ visible: false, category: null, expenses: [], loading: false });

  const getCategoryEmoji = (label) =>
    allCategories.find((c) => c.label === label)?.emoji ?? '';

  const openCategoryExpenses = async (cat) => {
    setCatModal({ visible: true, category: cat, expenses: [], loading: true });
    try {
      const { from } = localRangeBounds(range);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      const data = await api.getExpenses({ from, category: cat });
      // Exclude future-dated expenses from the drill-down
      const filtered = data.filter((e) => new Date(e.date) <= endOfToday);
      setCatModal((prev) => ({ ...prev, expenses: filtered, loading: false }));
    } catch {
      setCatModal((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
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
            <Text style={styles.totalAmount}>${spent.toFixed(2)}</Text>
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

          {/* Budget — always visible regardless of whether there are expenses */}
          <View style={styles.breakdown}>
            {currentBudget == null ? (
              <>
                <TouchableOpacity onPress={openBudgetModal} style={styles.setBudgetBtn}>
                  <Text style={styles.setBudgetText}>
                    Set {BUDGET_LABELS[range]} budget
                  </Text>
                </TouchableOpacity>
                <View style={styles.staticDivider} />
              </>
            ) : (
              <>
                <View style={styles.budgetRow}>
                  <Text style={[styles.budgetDiff, isOver ? styles.over : styles.under]}>
                    {isOver
                      ? `$${Math.abs(diff).toFixed(2)} over`
                      : `$${diff.toFixed(2)} remaining`}
                  </Text>
                  <TouchableOpacity onPress={openBudgetModal}>
                    <Text style={styles.budgetLabel}>
                      ${currentBudget.toFixed(2)} budget
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress * 100}%` },
                      isOver && styles.progressFillOver,
                    ]}
                  />
                </View>
              </>
            )}

            {/* Category breakdown — only when there are expenses */}
            {summary?.byCategory && Object.keys(summary.byCategory).length > 0 && (
              <>
                <Text style={styles.breakdownHeader}>By Category</Text>
                {Object.entries(summary.byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amount]) => (
                    <TouchableOpacity
                      key={cat}
                      style={styles.breakdownRow}
                      onPress={() => openCategoryExpenses(cat)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.breakdownEmoji}>{getCategoryEmoji(cat)}</Text>
                      <Text style={styles.breakdownLabel}>{cat}</Text>
                      <Text style={styles.breakdownAmount}>${amount.toFixed(2)}</Text>
                      <Text style={styles.breakdownChevron}>›</Text>
                    </TouchableOpacity>
                  ))}
              </>
            )}
          </View>
        </>
      )}

      {/* Category expenses modal */}
      <Modal visible={catModal.visible} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setCatModal((prev) => ({ ...prev, visible: false }))}>
          <Pressable style={[styles.modalSheet, styles.catModalSheet]} onPress={() => {}}>
            <View style={styles.catModalHeader}>
              <View style={styles.catModalTitleGroup}>
                {getCategoryEmoji(catModal.category) ? (
                  <Text style={styles.catModalEmoji}>{getCategoryEmoji(catModal.category)}</Text>
                ) : null}
                <Text style={styles.catModalTitle}>{catModal.category}</Text>
              </View>
              <TouchableOpacity onPress={() => setCatModal((prev) => ({ ...prev, visible: false }))}>
                <Text style={styles.catModalDone}>Done</Text>
              </TouchableOpacity>
            </View>
            {catModal.loading ? (
              <ActivityIndicator color={COLORS.text} style={{ marginTop: 24 }} />
            ) : catModal.expenses.length === 0 ? (
              <Text style={styles.catEmpty}>No expenses</Text>
            ) : (
              <>
                <View style={styles.catTopDivider} />
                <ScrollView showsVerticalScrollIndicator={false}>
                  {catModal.expenses.map((e) => (
                    <View key={e.id} style={styles.catExpenseRow}>
                      <View style={styles.catExpenseLeft}>
                        <Text style={styles.catExpenseTitle}>{e.title}</Text>
                        <Text style={styles.catExpenseDate}>
                          {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                      <Text style={styles.catExpenseAmount}>${e.amount.toFixed(2)}</Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showBudgetModal}
        animationType="none"
        transparent
        onShow={() => budgetInputRef.current?.focus()}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalOverlay} onPress={() => { setShowBudgetModal(false); setBudgetInput(''); }}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {RANGE_LABELS[range]} Budget
            </Text>

            <Text style={styles.modalLabel}>Amount</Text>
            <TextInput
              ref={budgetInputRef}
              style={styles.modalInput}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={COLORS.subtext}
              value={budgetInput}
              onChangeText={(v) => {
                if (/^\d*\.?\d{0,2}$/.test(v)) setBudgetInput(v);
              }}
              maxLength={8}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setShowBudgetModal(false); setBudgetInput(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, !budgetInput && currentBudget == null && styles.modalSaveDisabled]}
                onPress={saveBudget}
                disabled={!budgetInput && currentBudget == null}
              >
                <Text style={styles.modalSaveText}>
                  {!budgetInput && currentBudget != null ? 'Remove' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    marginTop: 12,
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
    paddingTop: 0,
  },
  staticDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 24,
  },
  setBudgetBtn: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  setBudgetText: {
    color: COLORS.subtext,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  budgetDiff: {
    fontSize: 14,
    fontWeight: '500',
  },
  under: {
    color: '#4CD964',
  },
  over: {
    color: '#C0392B',
  },
  budgetLabel: {
    color: COLORS.subtext,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  progressTrack: {
    height: 2,
    backgroundColor: COLORS.border,
    borderRadius: 1,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.text,
    borderRadius: 1,
  },
  progressFillOver: {
    backgroundColor: '#C0392B',
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
  breakdownChevron: {
    color: COLORS.subtext,
    fontSize: 18,
    marginLeft: 8,
  },
  catModalSheet: {
    maxHeight: '70%',
  },
  catModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  catModalTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catModalEmoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  catModalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
  catModalDone: {
    color: COLORS.subtext,
    fontSize: 15,
  },
  catTopDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 0,
  },
  catEmpty: {
    color: COLORS.subtext,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 24,
  },
  catExpenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  catExpenseLeft: {
    flex: 1,
    marginRight: 12,
  },
  catExpenseTitle: {
    color: COLORS.text,
    fontSize: 15,
    marginBottom: 2,
  },
  catExpenseDate: {
    color: COLORS.subtext,
    fontSize: 12,
  },
  catExpenseAmount: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 48,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
  },
  modalLabel: {
    color: COLORS.subtext,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: COLORS.pill,
    color: COLORS.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    backgroundColor: COLORS.pill,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    color: COLORS.subtext,
    fontSize: 15,
  },
  modalSave: {
    flex: 1,
    backgroundColor: COLORS.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveDisabled: {
    backgroundColor: COLORS.pill,
  },
  modalSaveText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: '600',
  },
});

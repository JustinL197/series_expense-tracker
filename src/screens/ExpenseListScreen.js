import React, { useState, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Pressable,
  Alert, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { api, localRangeBounds } from '../api/expenses';
import { COLORS } from '../constants';
import { useCategories } from '../context/CategoriesContext';
import { syncWidget } from '../utils/widgetSync';

const DATE_FILTERS = [
  { label: 'All time', value: null },
  { label: 'Today', value: 'day' },
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
];

const FREQ_LABELS = { weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly', yearly: 'Yearly' };

// 1st, 2nd, 3rd, 15th, 21st…
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export default function ExpenseListScreen() {
  const insets = useSafeAreaInsets();
  const { allCategories } = useCategories();

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'category'
  const [expandedCategories, setExpandedCategories] = useState({});

  const [dateFilter, setDateFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [recurringFilter, setRecurringFilter] = useState(false);
  const [upcomingFilter, setUpcomingFilter] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const [pendingDate, setPendingDate] = useState(null);
  const [pendingCategory, setPendingCategory] = useState(null);
  const [pendingRecurring, setPendingRecurring] = useState(false);
  const [pendingUpcoming, setPendingUpcoming] = useState(false);

  const [editTarget, setEditTarget] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDate, setEditDate] = useState(new Date());
  const [editTempDate, setEditTempDate] = useState(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editRecurringFreq, setEditRecurringFreq] = useState('monthly');
  const [showEditFreqDayPicker, setShowEditFreqDayPicker] = useState(false);
  const [editFreqTempDate, setEditFreqTempDate] = useState(new Date());

  const dateFilterRef = useRef(null);
  const categoryFilterRef = useRef(null);
  const recurringFilterRef = useRef(false);
  const upcomingFilterRef = useRef(false);

  const load = useCallback(async (dateF, categoryF, recurringF, upcomingF) => {
    try {
      const params = {};
      if (dateF) {
        const { from } = localRangeBounds(dateF);
        params.from = from;
      }
      if (categoryF) params.category = categoryF;
      if (recurringF) params.recurring = 'true';
      if (upcomingF) params.upcoming = 'true';
      const data = await api.getExpenses(params);
      setExpenses(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load(dateFilterRef.current, categoryFilterRef.current, recurringFilterRef.current, upcomingFilterRef.current);
  }, [load]));

  const openFilterSheet = () => {
    setPendingDate(dateFilter);
    setPendingCategory(categoryFilter);
    setPendingRecurring(recurringFilter);
    setPendingUpcoming(upcomingFilter);
    setShowFilterSheet(true);
  };

  const applyFilters = () => {
    dateFilterRef.current = pendingDate;
    categoryFilterRef.current = pendingCategory;
    recurringFilterRef.current = pendingRecurring;
    upcomingFilterRef.current = pendingUpcoming;
    setDateFilter(pendingDate);
    setCategoryFilter(pendingCategory);
    setRecurringFilter(pendingRecurring);
    setUpcomingFilter(pendingUpcoming);
    setShowFilterSheet(false);
    load(pendingDate, pendingCategory, pendingRecurring, pendingUpcoming);
  };

  const clearFilters = () => {
    setPendingDate(null);
    setPendingCategory(null);
    setPendingRecurring(false);
    setPendingUpcoming(false);
  };

  const handleDelete = (id) => {
    setEditTarget(null);
    Alert.alert('Delete', 'Remove this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await api.deleteExpense(id);
          setExpenses((prev) => prev.filter((e) => e.id !== id));
          syncWidget();
        },
      },
    ]);
  };

  const openEdit = (expense) => {
    setEditTarget(expense);
    setEditAmount(String(expense.amount));
    setEditTitle(expense.title);
    setEditCategory(expense.category);
    const d = new Date(expense.date);
    setEditDate(d);
    setEditTempDate(d);
    setEditIsRecurring(expense.isRecurring || false);
    setEditRecurringFreq(expense.recurringFreq || 'monthly');
    setShowEditFreqDayPicker(false);
  };

  const handleSaveEdit = async () => {
    try {
      const updated = await api.updateExpense(editTarget.id, {
        title: editTitle,
        category: editCategory,
        amount: parseFloat(editAmount),
        date: editDate.toISOString(),
        isRecurring: editIsRecurring,
        recurringFreq: editIsRecurring ? editRecurringFreq : null,
        recurringAutoAdd: editIsRecurring,
      });
      setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEditTarget(null);
      syncWidget();
    } catch (e) {
      Alert.alert('Error', 'Could not update expense.');
    }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const isUpcoming = d > endOfToday;
    return {
      text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      upcoming: isUpcoming,
    };
  };

  const getCategoryEmoji = (label) =>
    allCategories.find((c) => c.label === label)?.emoji ?? '';

  const hasActiveFilters = dateFilter !== null || categoryFilter !== null || recurringFilter || upcomingFilter;

  // Group expenses by category for category view
  const grouped = expenses.reduce((acc, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category].push(e);
    return acc;
  }, {});

  const toggleCategory = (cat) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const renderRow = (item) => {
    const { text: dateText, upcoming } = formatDate(item.date);
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.row}
        onPress={() => openEdit(item)}
        activeOpacity={0.7}
      >
        <View style={styles.rowLeft}>
          <Text style={styles.rowEmoji}>{getCategoryEmoji(item.category)}</Text>
          <View style={styles.rowMiddle}>
            <View style={styles.rowTitleRow}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              {item.isRecurring && (
                <Text style={styles.recurringIcon}>↻</Text>
              )}
            </View>
            <Text style={[styles.rowMeta, upcoming && styles.rowMetaUpcoming]}>
              {item.category} · {dateText}{upcoming ? ' · upcoming' : ''}
            </Text>
          </View>
        </View>
        <Text style={styles.rowAmount}>${item.amount.toFixed(2)}</Text>
      </TouchableOpacity>
    );
  };

  const renderAllView = () => (
    <FlatList
      data={expenses}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => renderRow(item)}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    />
  );

  const renderCategoryView = () => (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {Object.entries(grouped)
        .sort(([, a], [, b]) => b.reduce((s, e) => s + e.amount, 0) - a.reduce((s, e) => s + e.amount, 0))
        .map(([cat, items]) => {
          const total = items.reduce((s, e) => s + e.amount, 0);
          const expanded = expandedCategories[cat];
          return (
            <View key={cat}>
              <TouchableOpacity style={styles.categoryHeader} onPress={() => toggleCategory(cat)}>
                <View style={styles.categoryHeaderLeft}>
                  <Text style={styles.categoryEmoji}>{getCategoryEmoji(cat)}</Text>
                  <View>
                    <Text style={styles.categoryName}>{cat}</Text>
                    <Text style={styles.categoryCount}>{items.length} expense{items.length !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
                <View style={styles.categoryHeaderRight}>
                  <Text style={styles.categoryTotal}>${total.toFixed(2)}</Text>
                  <Text style={styles.chevron}>{expanded ? '›' : '›'}</Text>
                </View>
              </TouchableOpacity>
              {expanded && items.map((item) => (
                <View key={item.id} style={styles.categoryItem}>
                  {renderRow(item)}
                </View>
              ))}
            </View>
          );
        })}
    </ScrollView>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.header}>Expenses</Text>
        <TouchableOpacity
          style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
          onPress={openFilterSheet}
        >
          <Text style={[styles.filterBtnText, hasActiveFilters && styles.filterBtnTextActive]}>
            {hasActiveFilters ? 'Filtered' : 'Filter'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* View toggle */}
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segment, viewMode === 'all' && styles.segmentActive]}
          onPress={() => setViewMode('all')}
        >
          <Text style={[styles.segmentText, viewMode === 'all' && styles.segmentTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, viewMode === 'category' && styles.segmentActive]}
          onPress={() => setViewMode('category')}
        >
          <Text style={[styles.segmentText, viewMode === 'category' && styles.segmentTextActive]}>By Category</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.text} style={{ marginTop: 60 }} />
      ) : expenses.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No expenses yet.</Text>
        </View>
      ) : viewMode === 'all' ? renderAllView() : renderCategoryView()}

      {/* Filter sheet */}
      <Modal visible={showFilterSheet} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilterSheet(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>Filter</Text>
              <TouchableOpacity onPress={clearFilters}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>Date</Text>
              <View style={styles.pillGrid}>
                {DATE_FILTERS.map((f) => {
                  const active = pendingDate === f.value;
                  return (
                    <TouchableOpacity
                      key={f.label}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => setPendingDate(active ? null : f.value)}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {allCategories.length > 0 && (
                <>
                  <Text style={styles.modalLabel}>Category</Text>
                  <View style={styles.pillGrid}>
                    {allCategories.map((cat) => {
                      const active = pendingCategory === cat.label;
                      return (
                        <TouchableOpacity
                          key={cat.label}
                          style={[styles.pill, active && styles.pillActive]}
                          onPress={() => setPendingCategory(active ? null : cat.label)}
                        >
                          {cat.emoji ? <Text style={styles.pillEmoji}>{cat.emoji}</Text> : null}
                          <Text style={[styles.pillText, active && styles.pillTextActive]}>{cat.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.modalLabel}>Type</Text>
              <View style={styles.pillGrid}>
                <TouchableOpacity
                  style={[styles.pill, pendingRecurring && styles.pillActive]}
                  onPress={() => setPendingRecurring((v) => !v)}
                >
                  <Text style={[styles.pillText, pendingRecurring && styles.pillTextActive]}>↻ Recurring</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pill, pendingUpcoming && styles.pillActive]}
                  onPress={() => setPendingUpcoming((v) => !v)}
                >
                  <Text style={[styles.pillText, pendingUpcoming && styles.pillTextActive]}>Upcoming</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowFilterSheet(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={applyFilters}>
                <Text style={styles.modalSaveText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit modal */}
      <Modal visible={!!editTarget} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalOverlay} onPress={() => { setEditTarget(null); setShowEditDatePicker(false); }}>
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.editModalHeader}>
                <Text style={styles.modalTitle}>Edit Expense</Text>
                <TouchableOpacity
                  onPress={() => handleDelete(editTarget.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>

                <Text style={styles.modalLabel}>Amount</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="decimal-pad"
                  value={editAmount}
                  onChangeText={setEditAmount}
                  placeholderTextColor={COLORS.subtext}
                />

                <Text style={styles.modalLabel}>Note</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholderTextColor={COLORS.subtext}
                />

                <Text style={styles.modalLabel}>Category</Text>
                <View style={styles.pillGrid}>
                  {allCategories.map((cat) => {
                    const active = editCategory === cat.label;
                    return (
                      <TouchableOpacity
                        key={cat.label}
                        style={[styles.pill, active && styles.pillActive]}
                        onPress={() => setEditCategory(cat.label)}
                      >
                        {cat.emoji ? <Text style={styles.pillEmoji}>{cat.emoji}</Text> : null}
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{cat.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.modalLabel}>Date</Text>
                <TouchableOpacity style={styles.datePill} onPress={() => setShowEditDatePicker(true)}>
                  <Text style={styles.datePillText}>
                    {editDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </TouchableOpacity>
                {showEditDatePicker && (
                  <View>
                    <DateTimePicker
                      value={editTempDate}
                      mode="date"
                      display="spinner"
                      themeVariant="dark"
                      onChange={(_, selected) => { if (selected) setEditTempDate(selected); }}
                    />
                    <TouchableOpacity
                      style={styles.dateConfirmBtn}
                      onPress={() => { setEditDate(editTempDate); setShowEditDatePicker(false); }}
                    >
                      <Text style={styles.dateConfirmText}>✓ Confirm</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.recurringRow}>
                  <Text style={styles.modalLabel}>Recurring</Text>
                  <TouchableOpacity
                    style={[styles.toggleTrack, editIsRecurring && styles.toggleTrackOn]}
                    onPress={() => setEditIsRecurring((v) => !v)}
                  >
                    <View style={[styles.toggleThumb, editIsRecurring && styles.toggleThumbOn]} />
                  </TouchableOpacity>
                </View>
                {editIsRecurring && (
                  <>
                    <View style={styles.freqRow}>
                      {['weekly', 'biweekly', 'monthly', 'yearly'].map((f) => {
                        // Suppress regular highlight while the custom picker is open
                        const active = editRecurringFreq === f && !showEditFreqDayPicker;
                        return (
                          <TouchableOpacity
                            key={f}
                            style={[styles.pill, active && styles.pillActive]}
                            onPress={() => { setEditRecurringFreq(f); setShowEditFreqDayPicker(false); }}
                          >
                            <Text style={[styles.pillText, active && styles.pillTextActive]}>
                              {FREQ_LABELS[f]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      <TouchableOpacity
                        style={[styles.pill, (editRecurringFreq.startsWith('monthly:') || showEditFreqDayPicker) && styles.pillActive]}
                        onPress={() => {
                          if (showEditFreqDayPicker) {
                            setShowEditFreqDayPicker(false);
                          } else {
                            setEditFreqTempDate(new Date());
                            setShowEditFreqDayPicker(true);
                          }
                        }}
                      >
                        <Text style={[styles.pillText, (editRecurringFreq.startsWith('monthly:') || showEditFreqDayPicker) && styles.pillTextActive]}>
                          {editRecurringFreq.startsWith('monthly:')
                            ? `On the ${ordinal(parseInt(editRecurringFreq.split(':')[1], 10))}`
                            : 'Custom'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {showEditFreqDayPicker && (
                      <View>
                        <DateTimePicker
                          value={editFreqTempDate}
                          mode="date"
                          display="spinner"
                          themeVariant="dark"
                          onChange={(_, selected) => { if (selected) setEditFreqTempDate(selected); }}
                        />
                        <TouchableOpacity
                          style={styles.dateConfirmBtn}
                          onPress={() => {
                            setEditRecurringFreq(`monthly:${editFreqTempDate.getDate()}`);
                            setShowEditFreqDayPicker(false);
                          }}
                        >
                          <Text style={styles.dateConfirmText}>✓ Repeat on the {ordinal(editFreqTempDate.getDate())}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancel}
                    onPress={() => { setEditTarget(null); setShowEditDatePicker(false); }}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalSave} onPress={handleSaveEdit}>
                    <Text style={styles.modalSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  header: {
    color: COLORS.subtext,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.pill,
  },
  filterBtnActive: {
    backgroundColor: COLORS.pillActive,
  },
  filterBtnText: {
    color: COLORS.subtext,
    fontSize: 13,
  },
  filterBtnTextActive: {
    color: COLORS.pillActiveText,
    fontWeight: '600',
  },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: COLORS.pill,
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: COLORS.surface,
  },
  segmentText: {
    color: COLORS.subtext,
    fontSize: 13,
  },
  segmentTextActive: {
    color: COLORS.text,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 80,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  rowMiddle: {
    flex: 1,
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowEmoji: {
    fontSize: 22,
  },
  rowTitle: {
    color: COLORS.text,
    fontSize: 15,
    marginBottom: 2,
  },
  recurringIcon: {
    color: COLORS.subtext,
    fontSize: 13,
    marginBottom: 2,
  },
  rowMeta: {
    color: COLORS.subtext,
    fontSize: 12,
  },
  rowMetaUpcoming: {
    color: '#5A8A5A',
  },
  rowAmount: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  categoryEmoji: {
    fontSize: 22,
  },
  categoryName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  categoryCount: {
    color: COLORS.subtext,
    fontSize: 12,
  },
  categoryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryTotal: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
  },
  chevron: {
    color: COLORS.subtext,
    fontSize: 18,
  },
  categoryItem: {
    paddingLeft: 12,
    backgroundColor: COLORS.surface,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.subtext,
    fontSize: 15,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  clearText: {
    color: COLORS.subtext,
    fontSize: 14,
    textDecorationLine: 'underline',
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
    maxHeight: '90%',
  },
  modalScroll: {
    paddingBottom: 8,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
  modalLabel: {
    color: COLORS.subtext,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 16,
  },
  modalInput: {
    backgroundColor: COLORS.pill,
    color: COLORS.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 4,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.pill,
  },
  pillActive: {
    backgroundColor: COLORS.pillActive,
  },
  pillEmoji: {
    fontSize: 13,
  },
  pillText: {
    color: COLORS.subtext,
    fontSize: 13,
  },
  pillTextActive: {
    color: COLORS.pillActiveText,
    fontWeight: '600',
  },
  datePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: COLORS.pill,
    marginBottom: 12,
  },
  datePillText: {
    color: COLORS.text,
    fontSize: 14,
  },
  dateConfirmBtn: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: COLORS.text,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  dateConfirmText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '600',
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 12,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleTrackOn: {
    backgroundColor: '#FFFFFF',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#666666',
  },
  toggleThumbOn: {
    backgroundColor: '#000000',
    alignSelf: 'flex-end',
  },
  freqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
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
  modalSaveText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: '600',
  },
});

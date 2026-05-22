import React, { useState, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/expenses';
import { COLORS } from '../constants';
import { useCategories } from '../context/CategoriesContext';

const DATE_FILTERS = [
  { label: 'All time', value: null },
  { label: 'Today', value: 'day' },
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
];

export default function ExpenseListScreen() {
  const insets = useSafeAreaInsets();
  const { allCategories } = useCategories();

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  // Pending filter state inside the sheet (applied on "Apply")
  const [pendingDate, setPendingDate] = useState(null);
  const [pendingCategory, setPendingCategory] = useState(null);

  const [editTarget, setEditTarget] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDate, setEditDate] = useState(new Date());
  const [editTempDate, setEditTempDate] = useState(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  const dateFilterRef = useRef(null);
  const categoryFilterRef = useRef(null);

  const load = useCallback(async (dateF, categoryF) => {
    try {
      const params = {};
      if (dateF) params.range = dateF;
      if (categoryF) params.category = categoryF;
      const data = await api.getExpenses(params);
      setExpenses(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load(dateFilterRef.current, categoryFilterRef.current);
  }, [load]));

  const openFilterSheet = () => {
    setPendingDate(dateFilter);
    setPendingCategory(categoryFilter);
    setShowFilterSheet(true);
  };

  const applyFilters = () => {
    dateFilterRef.current = pendingDate;
    categoryFilterRef.current = pendingCategory;
    setDateFilter(pendingDate);
    setCategoryFilter(pendingCategory);
    setShowFilterSheet(false);
    load(pendingDate, pendingCategory);
  };

  const clearFilters = () => {
    setPendingDate(null);
    setPendingCategory(null);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Remove this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await api.deleteExpense(id);
          setExpenses((prev) => prev.filter((e) => e.id !== id));
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
  };

  const handleSaveEdit = async () => {
    try {
      const updated = await api.updateExpense(editTarget.id, {
        title: editTitle,
        category: editCategory,
        amount: parseFloat(editAmount),
        date: editDate.toISOString(),
      });
      setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEditTarget(null);
    } catch (e) {
      Alert.alert('Error', 'Could not update expense.');
    }
  };

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const getCategoryEmoji = (label) =>
    allCategories.find((c) => c.label === label)?.emoji ?? '';

  const hasActiveFilters = dateFilter !== null || categoryFilter !== null;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => openEdit(item)}
      onLongPress={() => handleDelete(item.id)}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.rowEmoji}>{getCategoryEmoji(item.category)}</Text>
        <View>
          <Text style={styles.rowTitle}>{item.title}</Text>
          <Text style={styles.rowMeta}>
            {item.category} · {formatDate(item.date)}
          </Text>
        </View>
      </View>
      <Text style={styles.rowAmount}>${item.amount.toFixed(2)}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>

      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.header}>Expenses</Text>
        <TouchableOpacity style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]} onPress={openFilterSheet}>
          <Text style={[styles.filterBtnText, hasActiveFilters && styles.filterBtnTextActive]}>
            {hasActiveFilters ? 'Filtered' : 'Filter'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.text} style={{ marginTop: 60 }} />
      ) : expenses.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No expenses yet.</Text>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Filter sheet */}
      <Modal visible={showFilterSheet} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>Filter</Text>
              <TouchableOpacity onPress={clearFilters}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>

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
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {f.label}
                    </Text>
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
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowFilterSheet(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={applyFilters}>
                <Text style={styles.modalSaveText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit modal */}
      <Modal visible={!!editTarget} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Edit Expense</Text>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScroll}
              >
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
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.modalLabel}>Date</Text>
                <TouchableOpacity
                  style={styles.datePill}
                  onPress={() => setShowEditDatePicker(true)}
                >
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
                      maximumDate={new Date()}
                      themeVariant="dark"
                      onChange={(_, selected) => {
                        if (selected) setEditTempDate(selected);
                      }}
                    />
                    <TouchableOpacity
                      style={styles.dateConfirmBtn}
                      onPress={() => {
                        setEditDate(editTempDate);
                        setShowEditDatePicker(false);
                      }}
                    >
                      <Text style={styles.dateConfirmText}>✓ Confirm</Text>
                    </TouchableOpacity>
                  </View>
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
            </View>
          </View>
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
    marginBottom: 20,
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
  list: {
    paddingBottom: 40,
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
  rowEmoji: {
    fontSize: 22,
  },
  rowTitle: {
    color: COLORS.text,
    fontSize: 15,
    marginBottom: 2,
  },
  rowMeta: {
    color: COLORS.subtext,
    fontSize: 12,
  },
  rowAmount: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
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
    marginBottom: 24,
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
    marginTop: 4,
  },
  modalInput: {
    backgroundColor: COLORS.pill,
    color: COLORS.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
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
    marginBottom: 20,
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
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
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

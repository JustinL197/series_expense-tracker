import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/expenses';
import { COLORS } from '../constants';
import { useCategories } from '../context/CategoriesContext';

export default function ExpenseListScreen() {
  const { allCategories } = useCategories();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');

  const load = useCallback(async () => {
    if (expenses.length === 0) setLoading(true);
    try {
      const params = activeFilter ? { category: activeFilter } : {};
      const data = await api.getExpenses(params);
      setExpenses(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
  };

  const handleSaveEdit = async () => {
    try {
      const updated = await api.updateExpense(editTarget.id, {
        title: editTitle,
        category: editCategory,
        amount: parseFloat(editAmount),
      });
      setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEditTarget(null);
    } catch (e) {
      Alert.alert('Error', 'Could not update expense.');
    }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getCategoryEmoji = (label) =>
    allCategories.find((c) => c.label === label)?.emoji ?? '';

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.row} onPress={() => openEdit(item)} onLongPress={() => handleDelete(item.id)}>
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
    <View style={styles.container}>
      <Text style={styles.header}>Expenses</Text>

      {/* Filter pills */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ label: 'All', emoji: '' }, ...allCategories]}
        keyExtractor={(item) => item.label}
        style={styles.filterList}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => {
          const isAll = item.label === 'All';
          const active = isAll ? activeFilter === null : activeFilter === item.label;
          return (
            <TouchableOpacity
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setActiveFilter(isAll ? null : item.label)}
            >
              {item.emoji ? <Text style={styles.filterEmoji}>{item.emoji}</Text> : null}
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

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

      {/* Edit modal */}
      <Modal visible={!!editTarget} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Edit Expense</Text>

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
                    <Text style={styles.pillEmoji}>{cat.emoji}</Text>
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setEditTarget(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleSaveEdit}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 70,
  },
  header: {
    color: COLORS.subtext,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  filterList: {
    flexGrow: 0,
    marginBottom: 16,
  },
  filterRow: {
    paddingHorizontal: 24,
    gap: 8,
    flexDirection: 'row',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.pill,
  },
  filterPillActive: {
    backgroundColor: COLORS.pillActive,
  },
  filterEmoji: {
    fontSize: 13,
  },
  filterText: {
    color: COLORS.subtext,
    fontSize: 13,
  },
  filterTextActive: {
    color: COLORS.pillActiveText,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
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
    marginBottom: 20,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
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
  modalSaveText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: '600',
  },
});

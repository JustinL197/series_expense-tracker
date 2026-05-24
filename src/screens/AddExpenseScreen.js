import React, { useState, useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Alert, ScrollView, Keyboard, Modal,
  Animated,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../api/expenses';
import { COLORS } from '../constants';
import { useCategories } from '../context/CategoriesContext';
import PageDots from '../components/PageDots';

export default function AddExpenseScreen() {
  const insets = useSafeAreaInsets();
  const { allCategories, addCategory, deleteCategory } = useCategories();

  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(null);
  const [date, setDate] = useState(new Date());
  const [tempDate, setTempDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFreq, setRecurringFreq] = useState('monthly');
  const [recurringAutoAdd, setRecurringAutoAdd] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('');
  const [deleteMode, setDeleteMode] = useState(false);
  const wiggle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (deleteMode) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(wiggle, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: -1, duration: 80, useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: 0, duration: 80, useNativeDriver: true }),
        ])
      ).start();
    } else {
      wiggle.stopAnimation();
      wiggle.setValue(0);
    }
  }, [deleteMode]);

  const canSubmit = amount && parseFloat(amount) > 0 && title.trim() && category;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await api.addExpense({
        title: title.trim(),
        category,
        amount: parseFloat(amount),
        date: date.toISOString(),
        isRecurring,
        recurringFreq: isRecurring ? recurringFreq : null,
        recurringAutoAdd: isRecurring ? recurringAutoAdd : false,
      });
      setAmount('');
      setTitle('');
      setCategory(null);
      setDate(new Date());
      setIsRecurring(false);
      setRecurringFreq('monthly');
      setRecurringAutoAdd(false);
      Alert.alert('', 'Expense added.');
    } catch (e) {
      Alert.alert('Error', 'Could not save expense.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const emoji = newCategoryEmoji.trim();
    await addCategory({ label: name, emoji });
    setCategory(name);
    setNewCategoryName('');
    setNewCategoryEmoji('');
    setShowAddCategory(false);
  };

  const formatDate = (d) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        {/* Amount */}
        <View style={styles.amountBlock}>
          <Text style={styles.amountCurrency}>$</Text>
          <TextInput
            style={styles.amountInput}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={(v) => {
              if (/^\d*\.?\d{0,2}$/.test(v)) setAmount(v);
            }}
            placeholder="0"
            placeholderTextColor={COLORS.border}
            maxLength={8}
          />
        </View>

        {/* Name */}
        <TextInput
          style={styles.nameInput}
          placeholder="Expense name"
          placeholderTextColor="#555555"
          value={title}
          onChangeText={setTitle}
          maxLength={50}
          returnKeyType="done"
        />

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.pillGrid}>
            {allCategories.map((cat) => {
              const active = category === cat.label;
              const rotation = wiggle.interpolate({
                inputRange: [-1, 1],
                outputRange: ['-3deg', '3deg'],
              });
              return (
                <Animated.View
                  key={cat.label}
                  style={deleteMode ? { transform: [{ rotate: rotation }] } : undefined}
                >
                  <TouchableOpacity
                    style={[styles.pill, active && !deleteMode && styles.pillActive]}
                    onPress={() => {
                      Keyboard.dismiss();
                      if (deleteMode) {
                        setDeleteMode(false);
                      } else {
                        setCategory(active ? null : cat.label);
                      }
                    }}
                    onLongPress={() => setDeleteMode(true)}
                    delayLongPress={400}
                  >
                    {cat.emoji ? <Text style={styles.pillEmoji}>{cat.emoji}</Text> : null}
                    <Text style={[styles.pillText, active && !deleteMode && styles.pillTextActive]}>
                      {cat.label}
                    </Text>
                    {deleteMode && (
                      <TouchableOpacity
                        style={styles.deleteBadge}
                        onPress={() => {
                          if (category === cat.label) setCategory(null);
                          deleteCategory(cat.label);
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.deleteBadgeText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
            {!deleteMode && (
              <TouchableOpacity
                style={styles.addCategoryPill}
                onPress={() => setShowAddCategory(true)}
              >
                <Text style={styles.addCategoryText}>+ Add</Text>
              </TouchableOpacity>
            )}
            {deleteMode && (
              <TouchableOpacity
                style={styles.donePill}
                onPress={() => setDeleteMode(false)}
              >
                <Text style={styles.donePillText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Date */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Date</Text>
          <TouchableOpacity
            style={styles.datePill}
            onPress={() => {
              Keyboard.dismiss();
              setTempDate(date);
              setShowDatePicker(true);
            }}
          >
            <Text style={styles.datePillText}>{formatDate(date)}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                themeVariant="dark"
                onChange={(_, selected) => {
                  if (selected) setTempDate(selected);
                }}
              />
              <TouchableOpacity
                style={styles.dateConfirmBtn}
                onPress={() => {
                  setDate(tempDate);
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.dateConfirmText}>✓ Confirm</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Recurring */}
        <View style={styles.section}>
          <View style={styles.recurringRow}>
            <Text style={styles.sectionLabel}>Recurring</Text>
            <TouchableOpacity
              style={[styles.toggleTrack, isRecurring && styles.toggleTrackOn]}
              onPress={() => setIsRecurring((v) => !v)}
            >
              <View style={[styles.toggleThumb, isRecurring && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>

          {isRecurring && (
            <>
              <View style={styles.freqRow}>
                {['weekly', 'monthly', 'yearly'].map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.freqPill, recurringFreq === f && styles.freqPillActive]}
                    onPress={() => setRecurringFreq(f)}
                  >
                    <Text style={[styles.freqText, recurringFreq === f && styles.freqTextActive]}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.recurringRow}>
                <Text style={styles.autoAddLabel}>Auto-add on due date</Text>
                <TouchableOpacity
                  style={[styles.toggleTrack, recurringAutoAdd && styles.toggleTrackOn]}
                  onPress={() => setRecurringAutoAdd((v) => !v)}
                >
                  <View style={[styles.toggleThumb, recurringAutoAdd && styles.toggleThumbOn]} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || loading}
        >
          <Text style={[styles.submitText, !canSubmit && styles.submitTextDisabled]}>
            {loading ? 'Saving...' : 'Add Expense'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <PageDots activeIndex={1} />

      {/* Add category modal */}
      <Modal visible={showAddCategory} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New Category</Text>

            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Gym, Pets, Travel"
              placeholderTextColor={COLORS.subtext}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
              maxLength={20}
              returnKeyType="next"
            />

            <Text style={styles.modalLabel}>Emoji</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 🏋️ (optional)"
              placeholderTextColor={COLORS.subtext}
              value={newCategoryEmoji}
              onChangeText={setNewCategoryEmoji}
              maxLength={4}
              returnKeyType="done"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setNewCategoryName('');
                  setNewCategoryEmoji('');
                  setShowAddCategory(false);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, !newCategoryName.trim() && styles.modalSaveDisabled]}
                onPress={handleAddCategory}
                disabled={!newCategoryName.trim()}
              >
                <Text style={styles.modalSaveText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  inner: {
    paddingTop: 0,
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  amountBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  amountCurrency: {
    color: COLORS.text,
    fontSize: 40,
    fontWeight: '200',
    marginRight: 2,
    lineHeight: 80,
  },
  amountInput: {
    color: COLORS.text,
    fontSize: 72,
    fontWeight: '200',
    letterSpacing: -3,
    minWidth: 60,
  },
  nameInput: {
    color: COLORS.text,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 12,
    marginBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    color: COLORS.subtext,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: COLORS.pill,
  },
  pillActive: {
    backgroundColor: COLORS.pillActive,
  },
  pillEmoji: {
    fontSize: 14,
  },
  pillText: {
    color: COLORS.subtext,
    fontSize: 14,
  },
  pillTextActive: {
    color: COLORS.pillActiveText,
    fontWeight: '600',
  },
  addCategoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  addCategoryText: {
    color: COLORS.subtext,
    fontSize: 14,
  },
  donePill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: COLORS.pill,
  },
  donePillText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  deleteBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  datePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: COLORS.pill,
  },
  datePillText: {
    color: COLORS.text,
    fontSize: 14,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    gap: 8,
    marginBottom: 14,
  },
  freqPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
  },
  freqPillActive: {
    backgroundColor: '#FFFFFF',
  },
  freqText: {
    color: '#888888',
    fontSize: 13,
  },
  freqTextActive: {
    color: '#000000',
    fontWeight: '600',
  },
  autoAddLabel: {
    color: '#888888',
    fontSize: 14,
  },
  dateConfirmBtn: {
    alignSelf: 'center',
    marginTop: 8,
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
  submitBtn: {
    backgroundColor: COLORS.text,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    backgroundColor: COLORS.pill,
  },
  submitText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '600',
  },
  submitTextDisabled: {
    color: COLORS.subtext,
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

import React, { useState, useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable, TextInput,
  KeyboardAvoidingView, Platform, Alert, ScrollView, Keyboard, Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../api/expenses';
import { COLORS } from '../constants';
import { useCategories } from '../context/CategoriesContext';
import { syncWidget } from '../utils/widgetSync';

const CHANGELOG = [
  {
    version: '2.0.0',
    items: [
      'Home screen widget — see today and this month\'s spending at a glance, updated the moment you add an expense',
      'Privacy eye on the widget — tap to hide amounts without opening the app',
      'Biweekly recurring expenses, plus "monthly on a chosen day" for subscriptions that bill on a specific date',
      'Biweekly summary period (fixed Sun–Sat fortnights) with its own budget',
      'Fixed: expired sessions now return you to the login screen instead of showing an empty app',
    ],
  },
  {
    version: '1.2.0',
    items: [
      'Tap a category in Summary to see a full breakdown of its expenses',
      'Budget bar now visible even with no expenses recorded',
      'Delete expense directly from the edit panel',
      'Tap outside any modal to dismiss it',
      'Smooth animated page indicator between screens',
      'Calendar navigation capped at your latest expense date',
      'Monthly total now shown in calendar view',
      'Fixed: today\'s expenses now correctly count toward today\'s total',
      'Fixed: week range is now Sun–Sat, not a rolling 7 days',
    ],
  },
];


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
  const [showFreqDayPicker, setShowFreqDayPicker] = useState(false);
  const [freqTempDate, setFreqTempDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const [showChangelog, setShowChangelog] = useState(false);
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
        recurringAutoAdd: isRecurring,
      });
      setAmount('');
      setTitle('');
      setCategory(null);
      setDate(new Date());
      setIsRecurring(false);
      setRecurringFreq('monthly');
      setShowFreqDayPicker(false);
      syncWidget();
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

  // 'monthly:15' = recurs monthly on the 15th
  const isCustomFreq = recurringFreq.startsWith('monthly:');
  const customFreqDay = isCustomFreq ? parseInt(recurringFreq.split(':')[1], 10) : null;

  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
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
        {/* Screen header */}
        <View style={styles.screenHeader}>
          <TouchableOpacity
            onPress={() => setShowChangelog(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="information-circle-outline" size={20} color={COLORS.subtext} />
          </TouchableOpacity>
        </View>

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
          <TouchableOpacity
            style={[styles.recurringPill, isRecurring && styles.recurringPillOn]}
            onPress={() => setIsRecurring((v) => !v)}
          >
            <Text style={[styles.recurringPillText, isRecurring && styles.recurringPillTextOn]}>
              ↻  Recurring  ·  {isRecurring ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>

          {isRecurring && (
            <>
              <View style={styles.freqRow}>
                {['weekly', 'biweekly', 'monthly', 'yearly'].map((f) => {
                  // Suppress regular highlight while the custom picker is open
                  const active = recurringFreq === f && !showFreqDayPicker;
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[styles.freqPill, active && styles.freqPillActive]}
                      onPress={() => { setRecurringFreq(f); setShowFreqDayPicker(false); }}
                    >
                      <Text style={[styles.freqText, active && styles.freqTextActive]}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.freqPill, (isCustomFreq || showFreqDayPicker) && styles.freqPillActive]}
                  onPress={() => {
                    Keyboard.dismiss();
                    if (showFreqDayPicker) {
                      setShowFreqDayPicker(false);
                    } else {
                      setFreqTempDate(new Date());
                      setShowFreqDayPicker(true);
                    }
                  }}
                >
                  <Text style={[styles.freqText, (isCustomFreq || showFreqDayPicker) && styles.freqTextActive]}>
                    {isCustomFreq ? `On the ${ordinal(customFreqDay)}` : 'Custom'}
                  </Text>
                </TouchableOpacity>
              </View>
              {showFreqDayPicker && (
                <View>
                  <DateTimePicker
                    value={freqTempDate}
                    mode="date"
                    display="spinner"
                    themeVariant="dark"
                    onChange={(_, selected) => {
                      if (selected) setFreqTempDate(selected);
                    }}
                  />
                  <TouchableOpacity
                    style={styles.dateConfirmBtn}
                    onPress={() => {
                      setRecurringFreq(`monthly:${freqTempDate.getDate()}`);
                      setShowFreqDayPicker(false);
                    }}
                  >
                    <Text style={styles.dateConfirmText}>✓ Repeat on the {ordinal(freqTempDate.getDate())}</Text>
                  </TouchableOpacity>
                </View>
              )}
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

      {/* Changelog modal */}
      <Modal visible={showChangelog} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowChangelog(false)}>
          <Pressable style={styles.changelogSheet} onPress={() => {}}>
            <View style={styles.changelogHeader}>
              <Text style={styles.changelogTitle}>What's New</Text>
              <TouchableOpacity onPress={() => setShowChangelog(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={COLORS.subtext} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CHANGELOG.map((release) => (
                <View key={release.version} style={styles.changelogRelease}>
                  <Text style={styles.changelogVersion}>v{release.version}</Text>
                  {release.items.map((item, i) => (
                    <View key={i} style={styles.changelogItem}>
                      <Text style={styles.changelogBullet}>·</Text>
                      <Text style={styles.changelogItemText}>{item}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add category modal */}
      <Modal visible={showAddCategory} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.modalOverlay} onPress={() => { setNewCategoryName(''); setNewCategoryEmoji(''); setShowAddCategory(false); }}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>New Category</Text>

            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Gym, Pets, Travel"
              placeholderTextColor={COLORS.subtext}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
              maxLength={30}
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
          </Pressable>
        </Pressable>
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
  recurringPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#1C1C1C',
    marginBottom: 14,
  },
  recurringPillOn: {
    backgroundColor: '#FFFFFF',
  },
  recurringPillText: {
    color: '#555555',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  recurringPillTextOn: {
    color: '#000000',
    fontWeight: '600',
  },
  freqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  brandingText: {
    fontFamily: 'Inter_400Regular',
    color: COLORS.subtext,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  changelogSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 48,
    maxHeight: '80%',
  },
  changelogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  changelogTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
  changelogRelease: {
    marginBottom: 28,
  },
  changelogVersion: {
    color: COLORS.subtext,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  changelogItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  changelogBullet: {
    color: COLORS.subtext,
    fontSize: 15,
    lineHeight: 22,
  },
  changelogItemText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
  },
});

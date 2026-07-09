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
import {
  REMINDER_DEFAULTS, loadReminders, updateReminder,
  requestNotificationPermission, formatReminderTime,
} from '../utils/reminders';
import RepeatSheet from '../components/RepeatSheet';
import { serializeRule, describeRule, occurrencesAfter } from '../utils/recurrence';

const COLLAPSED_CATEGORY_COUNT = 6;

const CHANGELOG = [
  {
    version: '2.2.0',
    items: [
      'All-new recurring setup — weekly, every 2 weeks, twice a month (pick two days or weekday pairs like 1st & 3rd Friday), monthly by day or weekday, quarterly, yearly',
      'Recurring end dates — perfect for financing that stops after a set period',
      'Live preview of your next three charges while setting up a recurring expense',
      'Fixed: recurring auto-add could create duplicate entries',
      'Fixed: What\'s New and other panels sometimes wouldn\'t scroll',
      'Clearer category collapse — "+N more" and "Show less" buttons',
    ],
  },
  {
    version: '2.1.0',
    items: [
      'Daily reminders — set midday and evening notifications to log your expenses (tap the bell)',
      'Search your expenses by name — tap the ⌕ icon on the Expenses screen',
      'Custom date range in filters — pick any start and end date',
      'Recurring expenses can repeat on a specific weekday (e.g. biweekly on Fridays)',
      'Category list on this screen now collapses',
      'Fixed: widget privacy icon alignment on smaller screens',
      'Fixed: category breakdown list in Summary now scrolls',
    ],
  },
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
  const [recurringRule, setRecurringRule] = useState(null);
  const [showRepeatSheet, setShowRepeatSheet] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showChangelog, setShowChangelog] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);

  // Reminder settings sheet
  const [showReminders, setShowReminders] = useState(false);
  const [reminders, setReminders] = useState(REMINDER_DEFAULTS);
  const [reminderPickerKey, setReminderPickerKey] = useState(null); // 'midday' | 'evening' | null
  const [reminderTempTime, setReminderTempTime] = useState(new Date());
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('');
  const [deleteMode, setDeleteMode] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const wiggle = useRef(new Animated.Value(0)).current;

  // Collapsed category grid shows the first few; delete mode forces full grid.
  // If the selected category would be hidden, swap it into the visible set.
  const showAllCategories =
    categoriesExpanded || deleteMode || allCategories.length <= COLLAPSED_CATEGORY_COUNT;
  let visibleCategories = allCategories;
  if (!showAllCategories) {
    visibleCategories = allCategories.slice(0, COLLAPSED_CATEGORY_COUNT);
    if (category && !visibleCategories.some((c) => c.label === category)) {
      const selected = allCategories.find((c) => c.label === category);
      if (selected) visibleCategories = [...visibleCategories.slice(0, -1), selected];
    }
  }

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
        isRecurring: isRecurring && !!recurringRule,
        recurringFreq: isRecurring && recurringRule ? serializeRule(recurringRule) : null,
        recurringAutoAdd: isRecurring && !!recurringRule,
      });
      setAmount('');
      setTitle('');
      setCategory(null);
      setDate(new Date());
      setIsRecurring(false);
      setRecurringRule(null);
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

  const toggleRecurring = () => {
    if (isRecurring) {
      setIsRecurring(false);
      return;
    }
    setIsRecurring(true);
    setRecurringRule({ type: 'monthly', interval: 1, day: date.getDate() });
    setShowRepeatSheet(true);
  };

  const nextPreview = isRecurring && recurringRule
    ? occurrencesAfter(recurringRule, date, 1, date)[0]
    : null;

  const openReminders = async () => {
    setReminders(await loadReminders());
    setReminderPickerKey(null);
    setShowReminders(true);
  };

  const toggleReminder = async (key) => {
    const r = reminders[key];
    if (!r.enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Notifications Off',
          'Enable notifications for Series Expense in iOS Settings to get reminders.'
        );
        return;
      }
    }
    const updated = await updateReminder(key, { enabled: !r.enabled, hour: r.hour, minute: r.minute });
    setReminders(updated);
  };

  const confirmReminderTime = async () => {
    const key = reminderPickerKey;
    const r = reminders[key];
    const updated = await updateReminder(key, {
      enabled: r.enabled,
      hour: reminderTempTime.getHours(),
      minute: reminderTempTime.getMinutes(),
    });
    setReminders(updated);
    setReminderPickerKey(null);
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
            onPress={openReminders}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="notifications-outline" size={19} color={COLORS.subtext} />
          </TouchableOpacity>
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
            {visibleCategories.map((cat) => {
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
            {!deleteMode && !showAllCategories && (
              <TouchableOpacity
                style={styles.moreCategoriesPill}
                onPress={() => setCategoriesExpanded(true)}
              >
                <Text style={styles.moreCategoriesText}>
                  +{allCategories.length - visibleCategories.length} more
                </Text>
                <Ionicons name="chevron-down" size={12} color={COLORS.subtext} />
              </TouchableOpacity>
            )}
            {!deleteMode && categoriesExpanded && allCategories.length > COLLAPSED_CATEGORY_COUNT && (
              <TouchableOpacity
                style={styles.moreCategoriesPill}
                onPress={() => setCategoriesExpanded(false)}
              >
                <Text style={styles.moreCategoriesText}>Show less</Text>
                <Ionicons name="chevron-up" size={12} color={COLORS.subtext} />
              </TouchableOpacity>
            )}
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
            onPress={() => { Keyboard.dismiss(); toggleRecurring(); }}
          >
            <Text style={[styles.recurringPillText, isRecurring && styles.recurringPillTextOn]}>
              ↻  Recurring  ·  {isRecurring ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>

          {isRecurring && recurringRule && (
            <TouchableOpacity style={styles.ruleSummary} onPress={() => setShowRepeatSheet(true)}>
              <View style={styles.ruleSummaryLeft}>
                <Text style={styles.ruleSummaryText}>{describeRule(recurringRule, date)}</Text>
                {nextPreview && (
                  <Text style={styles.ruleSummaryNext}>
                    Next: {nextPreview.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={15} color={COLORS.subtext} />
            </TouchableOpacity>
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

      {/* Recurring rule setup */}
      <RepeatSheet
        visible={showRepeatSheet}
        onClose={() => setShowRepeatSheet(false)}
        anchorDate={date}
        rule={recurringRule}
        onChange={setRecurringRule}
      />

      {/* Reminders modal */}
      <Modal visible={showReminders} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => { setShowReminders(false); setReminderPickerKey(null); }}
          />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Reminders</Text>
            <Text style={styles.reminderHint}>Daily nudges to log your expenses.</Text>

            {['midday', 'evening'].map((key) => {
              const r = reminders[key];
              return (
                <View key={key} style={styles.reminderRow}>
                  <Text style={styles.reminderLabel}>{key === 'midday' ? 'Midday' : 'Evening'}</Text>
                  <View style={styles.reminderControls}>
                    <TouchableOpacity
                      style={[styles.datePill, reminderPickerKey === key && styles.datePillActive]}
                      onPress={() => {
                        const t = new Date();
                        t.setHours(r.hour, r.minute, 0, 0);
                        setReminderTempTime(t);
                        setReminderPickerKey((k) => (k === key ? null : key));
                      }}
                    >
                      <Text style={styles.datePillText}>{formatReminderTime(r.hour, r.minute)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleTrack, r.enabled && styles.toggleTrackOn]}
                      onPress={() => toggleReminder(key)}
                    >
                      <View style={[styles.toggleThumb, r.enabled && styles.toggleThumbOn]} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {reminderPickerKey && (
              <View>
                <DateTimePicker
                  value={reminderTempTime}
                  mode="time"
                  display="spinner"
                  themeVariant="dark"
                  onChange={(_, selected) => { if (selected) setReminderTempTime(selected); }}
                />
                <TouchableOpacity style={styles.dateConfirmBtn} onPress={confirmReminderTime}>
                  <Text style={styles.dateConfirmText}>✓ Confirm</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Changelog modal */}
      <Modal visible={showChangelog} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowChangelog(false)} />
          <View style={styles.changelogSheet}>
            <View style={styles.changelogHeader}>
              <Text style={styles.changelogTitle}>What's New</Text>
              <TouchableOpacity onPress={() => setShowChangelog(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={COLORS.subtext} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
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
          </View>
        </View>
      </Modal>

      {/* Add category modal */}
      <Modal visible={showAddCategory} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => { setNewCategoryName(''); setNewCategoryEmoji(''); setShowAddCategory(false); }}
          />
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
  moreCategoriesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  moreCategoriesText: {
    color: COLORS.subtext,
    fontSize: 14,
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
  ruleSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
  },
  ruleSummaryLeft: {
    flex: 1,
    marginRight: 10,
  },
  ruleSummaryText: {
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 2,
  },
  ruleSummaryNext: {
    color: COLORS.subtext,
    fontSize: 12,
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
    alignItems: 'center',
    gap: 18,
    marginBottom: 4,
  },
  reminderHint: {
    color: COLORS.subtext,
    fontSize: 13,
    marginTop: -14,
    marginBottom: 20,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  reminderLabel: {
    color: COLORS.text,
    fontSize: 15,
  },
  reminderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  datePillActive: {
    backgroundColor: '#2A2A2A',
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

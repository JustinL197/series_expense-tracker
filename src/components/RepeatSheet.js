import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS } from '../constants';
import {
  WEEKDAY_SHORT, NTH_LABELS, ordinal, occurrencesAfter,
} from '../utils/recurrence';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const NTH_OPTIONS = [1, 2, 3, 4, -1];

const FREQ_OPTIONS = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'biweekly', label: 'Every 2 weeks' },
  { key: 'semimonthly', label: 'Twice a month' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
];

function freqKeyOf(rule) {
  if (!rule) return 'monthly';
  if (rule.type === 'weekly') return (rule.interval ?? 1) === 2 ? 'biweekly' : 'weekly';
  return rule.type;
}

function defaultRuleFor(key, anchor) {
  const a = new Date(anchor);
  switch (key) {
    case 'weekly': return { type: 'weekly', interval: 1, weekday: a.getDay() };
    case 'biweekly': return { type: 'weekly', interval: 2, weekday: a.getDay() };
    case 'semimonthly': return { type: 'semimonthly', slots: [{ day: 1 }, { day: 15 }] };
    case 'monthly': return { type: 'monthly', interval: 1, day: a.getDate() };
    case 'yearly': return { type: 'yearly' };
    default: return { type: 'monthly', interval: 1, day: a.getDate() };
  }
}

const slotText = (slot) =>
  slot.day != null ? ordinal(slot.day) : `${NTH_LABELS[slot.nth]} ${WEEKDAY_SHORT[slot.weekday]}`;

export default function RepeatSheet({ visible, onClose, anchorDate, rule, onChange }) {
  const [editingSlot, setEditingSlot] = useState(null); // null | 0 | 1
  const [showDaySpinner, setShowDaySpinner] = useState(null); // null | 'monthly' | 'slot' | 'end'
  const [tempDate, setTempDate] = useState(new Date());

  if (!rule) return null;

  const freqKey = freqKeyOf(rule);
  const anchor = new Date(anchorDate);

  const set = (patch) => onChange({ ...rule, ...patch });
  const keepEnd = (next) => (rule.end ? { ...next, end: rule.end } : next);

  const setFreq = (key) => {
    setEditingSlot(null);
    setShowDaySpinner(null);
    onChange(keepEnd(defaultRuleFor(key, anchor)));
  };

  const setSlot = (index, slot) => {
    const slots = [...(rule.slots || [])];
    slots[index] = slot;
    set({ slots });
  };

  const preview = occurrencesAfter(rule, anchor, 3, anchor);

  const openSpinner = (which, initial) => {
    setTempDate(initial);
    setShowDaySpinner((cur) => (cur === which ? null : which));
  };

  const confirmSpinner = () => {
    if (showDaySpinner === 'monthly') {
      set({ day: tempDate.getDate(), nth: undefined, weekday: undefined });
    } else if (showDaySpinner === 'slot' && editingSlot != null) {
      setSlot(editingSlot, { day: tempDate.getDate() });
    } else if (showDaySpinner === 'end') {
      const end = new Date(tempDate);
      end.setHours(23, 59, 59, 999);
      set({ end: end.toISOString() });
    }
    setShowDaySpinner(null);
  };

  const monthlyMode = rule.type === 'monthly' ? (rule.nth != null ? 'weekday' : 'day') : null;
  const editSlot = editingSlot != null ? (rule.slots || [])[editingSlot] : null;
  const slotMode = editSlot ? (editSlot.nth != null ? 'weekday' : 'day') : null;

  const dayCircles = (selected, onPick) => (
    <View style={styles.dayRow}>
      {DAY_LETTERS.map((label, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.dayCircle, selected === i && styles.dayCircleActive]}
          onPress={() => onPick(i)}
        >
          <Text style={[styles.dayCircleText, selected === i && styles.dayCircleTextActive]}>
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const nthPills = (selected, onPick) => (
    <View style={styles.pillRow}>
      {NTH_OPTIONS.map((n) => (
        <TouchableOpacity
          key={n}
          style={[styles.pill, selected === n && styles.pillActive]}
          onPress={() => onPick(n)}
        >
          <Text style={[styles.pillText, selected === n && styles.pillTextActive]}>
            {NTH_LABELS[n]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const modePills = (mode, onDay, onWeekday) => (
    <View style={styles.pillRow}>
      <TouchableOpacity
        style={[styles.pill, mode === 'day' && styles.pillActive]}
        onPress={onDay}
      >
        <Text style={[styles.pillText, mode === 'day' && styles.pillTextActive]}>Day of month</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.pill, mode === 'weekday' && styles.pillActive]}
        onPress={onWeekday}
      >
        <Text style={[styles.pillText, mode === 'weekday' && styles.pillTextActive]}>Weekday</Text>
      </TouchableOpacity>
    </View>
  );

  const spinner = (mode) => (
    <View>
      <DateTimePicker
        value={tempDate}
        mode={mode}
        display="spinner"
        themeVariant="dark"
        onChange={(_, selected) => { if (selected) setTempDate(selected); }}
      />
      <TouchableOpacity style={styles.confirmBtn} onPress={confirmSpinner}>
        <Text style={styles.confirmText}>
          ✓ {showDaySpinner === 'end'
            ? 'Confirm'
            : `Repeat on the ${ordinal(tempDate.getDate())}`}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Repeat</Text>

          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Frequency */}
            <View style={styles.pillRow}>
              {FREQ_OPTIONS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.pill, freqKey === f.key && styles.pillActive]}
                  onPress={() => setFreq(f.key)}
                >
                  <Text style={[styles.pillText, freqKey === f.key && styles.pillTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Weekly / biweekly: weekday */}
            {rule.type === 'weekly' &&
              dayCircles(rule.weekday ?? anchor.getDay(), (i) => set({ weekday: i }))}

            {/* Twice a month: two slots */}
            {rule.type === 'semimonthly' && (
              <>
                <Text style={styles.sectionLabel}>On</Text>
                <View style={styles.pillRow}>
                  {(rule.slots || []).map((slot, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.pill, editingSlot === i && styles.pillActive]}
                      onPress={() => {
                        setShowDaySpinner(null);
                        setEditingSlot((cur) => (cur === i ? null : i));
                      }}
                    >
                      <Text style={[styles.pillText, editingSlot === i && styles.pillTextActive]}>
                        {slotText(slot)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {editSlot && (
                  <View style={styles.subSection}>
                    {modePills(
                      slotMode,
                      () => {
                        const d = new Date(anchor);
                        d.setDate(editSlot.day ?? 1);
                        openSpinner('slot', d);
                      },
                      () => setSlot(editingSlot, { nth: 1, weekday: anchor.getDay() })
                    )}
                    {slotMode === 'weekday' && (
                      <>
                        {nthPills(editSlot.nth, (n) => setSlot(editingSlot, { ...editSlot, nth: n }))}
                        {dayCircles(editSlot.weekday, (i) => setSlot(editingSlot, { ...editSlot, weekday: i }))}
                      </>
                    )}
                    {showDaySpinner === 'slot' && spinner('date')}
                  </View>
                )}
              </>
            )}

            {/* Monthly: day-of-month or nth weekday + interval */}
            {rule.type === 'monthly' && (
              <>
                {modePills(
                  monthlyMode,
                  () => {
                    const d = new Date(anchor);
                    d.setDate(rule.day ?? anchor.getDate());
                    openSpinner('monthly', d);
                  },
                  () => set({ nth: 1, weekday: anchor.getDay(), day: undefined })
                )}
                {monthlyMode === 'day' && showDaySpinner !== 'monthly' && (
                  <TouchableOpacity
                    style={styles.valuePill}
                    onPress={() => {
                      const d = new Date(anchor);
                      d.setDate(rule.day ?? anchor.getDate());
                      openSpinner('monthly', d);
                    }}
                  >
                    <Text style={styles.valuePillText}>On the {ordinal(rule.day ?? anchor.getDate())}</Text>
                  </TouchableOpacity>
                )}
                {showDaySpinner === 'monthly' && spinner('date')}
                {monthlyMode === 'weekday' && (
                  <>
                    {nthPills(rule.nth, (n) => set({ nth: n }))}
                    {dayCircles(rule.weekday, (i) => set({ weekday: i }))}
                  </>
                )}
                <View style={styles.intervalRow}>
                  <Text style={styles.intervalLabel}>Every</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => set({ interval: Math.max(1, (rule.interval ?? 1) - 1) })}
                  >
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.intervalValue}>{rule.interval ?? 1}</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => set({ interval: Math.min(12, (rule.interval ?? 1) + 1) })}
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                  <Text style={styles.intervalLabel}>
                    month{(rule.interval ?? 1) > 1 ? 's' : ''}
                  </Text>
                </View>
              </>
            )}

            {rule.type === 'yearly' && (
              <Text style={styles.yearlyNote}>
                Repeats every year on{' '}
                {anchor.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.
              </Text>
            )}

            {/* End condition */}
            <Text style={styles.sectionLabel}>Ends</Text>
            <View style={styles.pillRow}>
              <TouchableOpacity
                style={[styles.pill, !rule.end && styles.pillActive]}
                onPress={() => {
                  setShowDaySpinner(null);
                  const { end, ...rest } = rule;
                  onChange(rest);
                }}
              >
                <Text style={[styles.pillText, !rule.end && styles.pillTextActive]}>Never</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pill, !!rule.end && styles.pillActive]}
                onPress={() => {
                  const initial = rule.end ? new Date(rule.end) : new Date(anchor);
                  openSpinner('end', initial);
                }}
              >
                <Text style={[styles.pillText, !!rule.end && styles.pillTextActive]}>
                  {rule.end
                    ? new Date(rule.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'On a date'}
                </Text>
              </TouchableOpacity>
            </View>
            {showDaySpinner === 'end' && spinner('date')}

            {/* Preview */}
            <Text style={styles.sectionLabel}>Next</Text>
            <Text style={styles.previewText}>
              {preview.length > 0
                ? preview
                    .map((d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
                    .join('  ·  ')
                : 'No upcoming occurrences'}
            </Text>
          </ScrollView>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
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
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 48,
    maxHeight: '88%',
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  sectionLabel: {
    color: COLORS.subtext,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 12,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.pill,
  },
  pillActive: {
    backgroundColor: COLORS.pillActive,
  },
  pillText: {
    color: COLORS.subtext,
    fontSize: 13,
  },
  pillTextActive: {
    color: COLORS.pillActiveText,
    fontWeight: '600',
  },
  subSection: {
    marginTop: 12,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: COLORS.pillActive,
  },
  dayCircleText: {
    color: COLORS.subtext,
    fontSize: 13,
  },
  dayCircleTextActive: {
    color: COLORS.pillActiveText,
    fontWeight: '600',
  },
  valuePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: COLORS.pill,
    marginTop: 12,
  },
  valuePillText: {
    color: COLORS.text,
    fontSize: 14,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
  },
  intervalLabel: {
    color: COLORS.subtext,
    fontSize: 14,
  },
  intervalValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    minWidth: 22,
    textAlign: 'center',
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: COLORS.text,
    fontSize: 18,
    lineHeight: 20,
  },
  yearlyNote: {
    color: COLORS.subtext,
    fontSize: 14,
    marginTop: 12,
  },
  confirmBtn: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: COLORS.text,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  confirmText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '600',
  },
  previewText: {
    color: COLORS.text,
    fontSize: 15,
  },
  doneBtn: {
    backgroundColor: COLORS.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  doneText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: '600',
  },
});

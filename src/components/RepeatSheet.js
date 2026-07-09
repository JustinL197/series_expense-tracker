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

// The two "twice a month" selections are distinguished by color —
// light blue / dark blue, same family so neither reads as a status color
const SLOT_COLORS = [
  { bg: '#8AB4F8', fg: '#0B1B33' },
  { bg: '#3A6EA5', fg: '#FFFFFF' },
];

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
  const [editingSlot, setEditingSlot] = useState(0); // semimonthly: which slot is being edited
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [endTempDate, setEndTempDate] = useState(new Date());

  if (!rule) return null;

  const freqKey = freqKeyOf(rule);
  const anchor = new Date(anchorDate);

  const set = (patch) => onChange({ ...rule, ...patch });
  const keepEnd = (next) => (rule.end ? { ...next, end: rule.end } : next);

  const setFreq = (key) => {
    setEditingSlot(0);
    setShowEndPicker(false);
    onChange(keepEnd(defaultRuleFor(key, anchor)));
  };

  const setSlot = (index, slot) => {
    const slots = [...(rule.slots || [])];
    slots[index] = slot;
    set({ slots });
  };

  const preview = occurrencesAfter(rule, anchor, 3, anchor);

  // --- Small building blocks ---
  // `color` tints the active state (used to link controls to a colored pair chip)

  const dayCircles = (selected, onPick, color) => (
    <View style={styles.dayRow}>
      {DAY_LETTERS.map((label, i) => {
        const active = selected === i;
        return (
          <TouchableOpacity
            key={i}
            style={[
              styles.dayCircle,
              active && (color ? { backgroundColor: color.bg } : styles.dayCircleActive),
            ]}
            onPress={() => onPick(i)}
          >
            <Text
              style={[
                styles.dayCircleText,
                active && (color ? { color: color.fg, fontWeight: '600' } : styles.dayCircleTextActive),
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // Plain 1–31 grid — no month/year clutter
  const dayGrid = (selected, onPick) => (
    <>
      <View style={styles.dayGrid}>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.dayCell, selected === d && styles.dayCellActive]}
            onPress={() => onPick(d)}
          >
            <Text style={[styles.dayCellText, selected === d && styles.dayCellTextActive]}>
              {d}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {selected >= 29 && (
        <Text style={styles.clampNote}>
          Months without a {ordinal(selected)} use their last day.
        </Text>
      )}
    </>
  );

  const nthPills = (selected, onPick, color) => (
    <View style={styles.pillRow}>
      {NTH_OPTIONS.map((n) => {
        const active = selected === n;
        return (
          <TouchableOpacity
            key={n}
            style={[
              styles.pill,
              active && (color ? { backgroundColor: color.bg } : styles.pillActive),
            ]}
            onPress={() => onPick(n)}
          >
            <Text
              style={[
                styles.pillText,
                active && (color ? { color: color.fg, fontWeight: '600' } : styles.pillTextActive),
              ]}
            >
              {NTH_LABELS[n]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // Movie-theater style two-day picker: tap to select (up to 2, shown in two
  // colors), tap a selected day to remove it, tap a third day to replace the
  // older selection. Color follows sorted position so earlier day = white.
  const dayGridTwo = (slots, onChangeSlots) => {
    const days = slots.filter((s) => s.day != null).map((s) => s.day);
    const sorted = [...days].sort((a, b) => a - b);
    const colorFor = (d) => SLOT_COLORS[sorted.indexOf(d)];
    const toggle = (d) => {
      if (days.includes(d)) {
        if (days.length === 1) return; // keep at least one day selected
        onChangeSlots(slots.filter((s) => s.day !== d));
      } else if (days.length < 2) {
        onChangeSlots([...slots, { day: d }]);
      } else {
        // replace the older (first-added) selection
        onChangeSlots([...slots.slice(1), { day: d }]);
      }
    };
    return (
      <>
        <View style={styles.dayGrid}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
            const color = days.includes(d) ? colorFor(d) : null;
            return (
              <TouchableOpacity
                key={d}
                style={[styles.dayCell, color && { backgroundColor: color.bg }]}
                onPress={() => toggle(d)}
              >
                <Text style={[styles.dayCellText, color && { color: color.fg, fontWeight: '600' }]}>
                  {d}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {sorted.some((d) => d >= 29) && (
          <Text style={styles.clampNote}>
            Months without a {ordinal(Math.max(...sorted.filter((d) => d >= 29)))} use their last day.
          </Text>
        )}
      </>
    );
  };

  // Mode taps update the rule IMMEDIATELY so the highlight always matches
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

  // --- Contextual panel content per frequency ---

  const monthlyMode = rule.type === 'monthly' ? (rule.nth != null ? 'weekday' : 'day') : null;
  const editSlot = (rule.slots || [])[editingSlot];

  const panelContent = () => {
    if (rule.type === 'weekly') {
      return dayCircles(rule.weekday ?? anchor.getDay(), (i) => set({ weekday: i }));
    }

    if (rule.type === 'semimonthly') {
      // One mode for the whole rule: both selections are days-of-month OR
      // both are weekday pairs.
      const semiMode = (rule.slots?.[0]?.day != null) ? 'day' : 'weekday';
      const activeColor = SLOT_COLORS[editingSlot];
      return (
        <>
          {modePills(
            semiMode,
            () => { setEditingSlot(0); set({ slots: [{ day: 1 }, { day: 15 }] }); },
            () => {
              setEditingSlot(0);
              set({
                slots: [
                  { nth: 1, weekday: anchor.getDay() },
                  { nth: 3, weekday: anchor.getDay() },
                ],
              });
            }
          )}
          <View style={styles.nested}>
            {semiMode === 'day' && dayGridTwo(rule.slots || [], (slots) => set({ slots }))}
            {semiMode === 'weekday' && (
              <>
                <View style={styles.pillRow}>
                  {(rule.slots || []).map((slot, i) => {
                    const c = SLOT_COLORS[i];
                    const active = editingSlot === i;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.pairChip,
                          { backgroundColor: c.bg },
                          active && styles.pairChipActive,
                        ]}
                        onPress={() => setEditingSlot(i)}
                      >
                        <Text style={[styles.pairChipText, { color: c.fg }]}>
                          {slotText(slot)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {editSlot && (
                  <>
                    {nthPills(editSlot.nth, (n) => setSlot(editingSlot, { ...editSlot, nth: n }), activeColor)}
                    {dayCircles(editSlot.weekday, (i) => setSlot(editingSlot, { ...editSlot, weekday: i }), activeColor)}
                  </>
                )}
              </>
            )}
          </View>
        </>
      );
    }

    if (rule.type === 'monthly') {
      return (
        <>
          {modePills(
            monthlyMode,
            () => set({ nth: undefined, weekday: undefined, day: rule.day ?? anchor.getDate() }),
            () => set({ nth: rule.nth ?? 1, weekday: rule.weekday ?? anchor.getDay(), day: undefined })
          )}
          <View style={styles.nested}>
            {monthlyMode === 'day' &&
              dayGrid(rule.day ?? anchor.getDate(), (d) => set({ day: d }))}
            {monthlyMode === 'weekday' && (
              <>
                {nthPills(rule.nth, (n) => set({ nth: n }))}
                {dayCircles(rule.weekday, (i) => set({ weekday: i }))}
              </>
            )}
          </View>
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
      );
    }

    // yearly
    return (
      <Text style={styles.yearlyNote}>
        Repeats every year on{' '}
        {anchor.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.
      </Text>
    );
  };

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

            {/* Contextual options — visually nested in an inset panel */}
            <View style={styles.panel}>
              <Text style={styles.panelLabel}>
                {rule.type === 'weekly' ? 'Repeats on' : 'Options'}
              </Text>
              {panelContent()}
            </View>

            {/* End condition */}
            <Text style={styles.sectionLabel}>Ends</Text>
            <View style={styles.pillRow}>
              <TouchableOpacity
                style={[styles.pill, !rule.end && styles.pillActive]}
                onPress={() => {
                  setShowEndPicker(false);
                  const { end, ...rest } = rule;
                  onChange(rest);
                }}
              >
                <Text style={[styles.pillText, !rule.end && styles.pillTextActive]}>Never</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pill, !!rule.end && styles.pillActive]}
                onPress={() => {
                  setEndTempDate(rule.end ? new Date(rule.end) : new Date(anchor));
                  setShowEndPicker((v) => !v);
                }}
              >
                <Text style={[styles.pillText, !!rule.end && styles.pillTextActive]}>
                  {rule.end
                    ? new Date(rule.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'On a date'}
                </Text>
              </TouchableOpacity>
            </View>
            {showEndPicker && (
              <View>
                <DateTimePicker
                  value={endTempDate}
                  mode="date"
                  display="spinner"
                  themeVariant="dark"
                  onChange={(_, selected) => { if (selected) setEndTempDate(selected); }}
                />
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => {
                    const end = new Date(endTempDate);
                    end.setHours(23, 59, 59, 999);
                    set({ end: end.toISOString() });
                    setShowEndPicker(false);
                  }}
                >
                  <Text style={styles.confirmText}>✓ Confirm</Text>
                </TouchableOpacity>
              </View>
            )}

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
    marginTop: 20,
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
  panel: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  panelLabel: {
    color: COLORS.subtext,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  nested: {
    marginTop: 12,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 2,
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
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  dayCell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellActive: {
    backgroundColor: COLORS.pillActive,
  },
  dayCellText: {
    color: COLORS.subtext,
    fontSize: 12,
  },
  dayCellTextActive: {
    color: COLORS.pillActiveText,
    fontWeight: '600',
  },
  clampNote: {
    color: COLORS.subtext,
    fontSize: 11,
    marginTop: 10,
  },
  pairChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pairChipActive: {
    borderColor: '#888888',
  },
  pairChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
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

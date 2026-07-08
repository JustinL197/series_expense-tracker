import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// Two daily local reminders to log expenses. Fully on-device — no push
// server involved. Each reminder: { enabled, hour, minute, notifId }.
const STORAGE_KEY = 'reminders';

export const REMINDER_DEFAULTS = {
  midday: { enabled: false, hour: 13, minute: 0, notifId: null },
  evening: { enabled: false, hour: 21, minute: 0, notifId: null },
};

const MESSAGES = {
  midday: { title: 'Series Expense', body: 'Midday check-in — log anything you\'ve spent so far.' },
  evening: { title: 'Series Expense', body: 'Quick reminder to log today\'s expenses.' },
};

export async function loadReminders() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...REMINDER_DEFAULTS };
    return { ...REMINDER_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...REMINDER_DEFAULTS };
  }
}

async function saveReminders(reminders) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

export async function requestNotificationPermission() {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

// Enable/disable/re-time one reminder. Returns the updated reminders object.
export async function updateReminder(key, { enabled, hour, minute }) {
  const reminders = await loadReminders();
  const current = reminders[key];

  // Cancel any existing schedule for this reminder before re-scheduling
  if (current.notifId) {
    await Notifications.cancelScheduledNotificationAsync(current.notifId).catch(() => {});
  }

  let notifId = null;
  if (enabled) {
    notifId = await Notifications.scheduleNotificationAsync({
      content: MESSAGES[key],
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  }

  const updated = { ...reminders, [key]: { enabled, hour, minute, notifId } };
  await saveReminders(updated);
  return updated;
}

export function formatReminderTime(hour, minute) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

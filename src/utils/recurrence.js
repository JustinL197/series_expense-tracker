// Shared recurrence rule engine — used by the RepeatSheet preview and mirrored
// in server/index.js (keep the two in sync when changing occurrence math).
//
// Rule shapes:
//   { type: 'weekly',      interval: 1|2, weekday: 0-6, end?: 'ISO' }
//   { type: 'semimonthly', slots: [Slot, Slot], end?: 'ISO' }
//   { type: 'monthly',     interval: 1-12, day?: 1-31, nth?: 1-4|-1, weekday?: 0-6, end?: 'ISO' }
//   { type: 'yearly',      end?: 'ISO' }              // anniversary of the expense date
//   Slot = { day: 1-31 } | { nth: 1-4|-1, weekday: 0-6 }
//
// Legacy string encodings still parse: 'weekly', 'biweekly', 'monthly',
// 'yearly', 'weekly:N', 'biweekly:N', 'monthly:N'.

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const NTH_LABELS = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', '-1': 'Last' };

export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function parseRule(freq) {
  if (!freq) return null;
  if (freq.startsWith('{')) {
    try { return JSON.parse(freq); } catch { return null; }
  }
  if (freq === 'weekly') return { type: 'weekly', interval: 1 };
  if (freq === 'biweekly') return { type: 'weekly', interval: 2 };
  if (freq === 'monthly') return { type: 'monthly', interval: 1 };
  if (freq === 'yearly') return { type: 'yearly' };
  if (freq.startsWith('weekly:')) return { type: 'weekly', interval: 1, weekday: +freq.split(':')[1] };
  if (freq.startsWith('biweekly:')) return { type: 'weekly', interval: 2, weekday: +freq.split(':')[1] };
  if (freq.startsWith('monthly:')) return { type: 'monthly', interval: 1, day: +freq.split(':')[1] };
  return null;
}

// Simple rules keep the legacy encoding (old clients/rows stay compatible);
// anything richer serializes as JSON.
export function serializeRule(rule) {
  if (!rule) return null;
  const { type, interval = 1, weekday, day, nth, end } = rule;
  if (!end) {
    if (type === 'weekly' && weekday != null) return `${interval === 2 ? 'biweekly' : 'weekly'}:${weekday}`;
    if (type === 'weekly') return interval === 2 ? 'biweekly' : 'weekly';
    if (type === 'monthly' && interval === 1 && nth == null) {
      return day != null ? `monthly:${day}` : 'monthly';
    }
    if (type === 'yearly') return 'yearly';
  }
  return JSON.stringify(rule);
}

const clampDay = (y, m, day) => Math.min(day, new Date(y, m + 1, 0).getDate());

function nthWeekdayOfMonth(y, m, nth, weekday) {
  if (nth === -1) {
    const last = new Date(y, m + 1, 0);
    const diff = (last.getDay() - weekday + 7) % 7;
    return new Date(y, m, last.getDate() - diff);
  }
  const first = new Date(y, m, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const dayNum = 1 + offset + (nth - 1) * 7;
  if (dayNum > new Date(y, m + 1, 0).getDate()) return null; // no 5th <weekday> this month
  return new Date(y, m, dayNum);
}

// First occurrence strictly after `after`. `anchor` is the expense date — it
// fixes the biweekly phase, the implicit weekday/day for legacy rules, and
// the yearly anniversary. Returns null when the rule has ended.
export function nextOccurrence(rule, after, anchor) {
  if (!rule) return null;
  const a = new Date(after);
  const anc = new Date(anchor);
  const withTime = (d) => {
    d.setHours(anc.getHours(), anc.getMinutes(), anc.getSeconds(), 0);
    return d;
  };
  const gate = (occ) => {
    if (!occ) return null;
    if (rule.end && occ > endOfDay(rule.end)) return null;
    return occ;
  };

  if (rule.type === 'weekly') {
    const weekday = rule.weekday ?? anc.getDay();
    const cycle = 7 * (rule.interval ?? 1);
    const phase = new Date(anc);
    let delta = (weekday - phase.getDay() + 7) % 7;
    if (delta === 0) delta = cycle;
    phase.setDate(phase.getDate() + delta);
    while (phase <= a) phase.setDate(phase.getDate() + cycle);
    return gate(phase);
  }

  if (rule.type === 'monthly') {
    const interval = rule.interval ?? 1;
    for (let k = 0; k < 600; k++) {
      const mIndex = anc.getMonth() + k * interval;
      const y = anc.getFullYear() + Math.floor(mIndex / 12);
      const m = ((mIndex % 12) + 12) % 12;
      let occ;
      if (rule.nth != null) {
        occ = nthWeekdayOfMonth(y, m, rule.nth, rule.weekday);
        if (!occ) continue;
      } else {
        occ = new Date(y, m, clampDay(y, m, rule.day ?? anc.getDate()));
      }
      withTime(occ);
      if (occ > a) return gate(occ);
    }
    return null;
  }

  if (rule.type === 'semimonthly') {
    for (let k = 0; k < 120; k++) {
      const mIndex = anc.getMonth() + k;
      const y = anc.getFullYear() + Math.floor(mIndex / 12);
      const m = ((mIndex % 12) + 12) % 12;
      const occs = (rule.slots || [])
        .map((s) => (s.day != null
          ? new Date(y, m, clampDay(y, m, s.day))
          : nthWeekdayOfMonth(y, m, s.nth, s.weekday)))
        .filter(Boolean)
        .map(withTime)
        .sort((x, z) => x - z);
      for (const occ of occs) if (occ > a) return gate(occ);
    }
    return null;
  }

  if (rule.type === 'yearly') {
    for (let k = 0; k < 100; k++) {
      const y = anc.getFullYear() + k;
      const occ = withTime(new Date(y, anc.getMonth(), clampDay(y, anc.getMonth(), anc.getDate())));
      if (occ > a) return gate(occ);
    }
    return null;
  }

  return null;
}

function endOfDay(iso) {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function occurrencesAfter(rule, after, count, anchor) {
  const out = [];
  let cursor = after;
  for (let i = 0; i < count; i++) {
    const occ = nextOccurrence(rule, cursor, anchor);
    if (!occ) break;
    out.push(occ);
    cursor = occ;
  }
  return out;
}

function slotLabel(slot) {
  if (slot.day != null) return `the ${ordinal(slot.day)}`;
  return `${NTH_LABELS[slot.nth]} ${WEEKDAY_SHORT[slot.weekday]}`;
}

export function describeRule(rule, anchor) {
  if (!rule) return '';
  const anc = new Date(anchor);
  let text = '';
  if (rule.type === 'weekly') {
    const weekday = rule.weekday ?? anc.getDay();
    text = `${(rule.interval ?? 1) === 2 ? 'Every 2 weeks' : 'Weekly'} on ${WEEKDAY_SHORT[weekday]}`;
  } else if (rule.type === 'semimonthly') {
    const slots = [...(rule.slots || [])];
    if (slots.every((s) => s.day != null)) slots.sort((x, z) => x.day - z.day);
    text = `Twice a month — ${slots.map(slotLabel).join(' & ')}`;
  } else if (rule.type === 'monthly') {
    const interval = rule.interval ?? 1;
    const every = interval === 1 ? 'Monthly' : `Every ${interval} months`;
    text = rule.nth != null
      ? `${every} on the ${NTH_LABELS[rule.nth]} ${WEEKDAY_SHORT[rule.weekday]}`
      : `${every} on the ${ordinal(rule.day ?? anc.getDate())}`;
  } else if (rule.type === 'yearly') {
    text = `Yearly on ${anc.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  if (rule.end) {
    text += ` · until ${new Date(rule.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return text;
}

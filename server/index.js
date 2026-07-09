require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const appleSignin = require('apple-signin-auth');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID;

const DEFAULT_CATEGORIES = [
  { label: 'Food', emoji: '🍔' },
  { label: 'Bills', emoji: '💸' },
  { label: 'Streaming Services', emoji: '📺' },
  { label: 'Rent', emoji: '🏠' },
  { label: 'Leisure', emoji: '🎉' },
];

app.use(cors());
app.use(express.json());

// --- Recurrence engine ---
// Mirror of src/utils/recurrence.js on the frontend — keep in sync.
// Rule shapes: { type: 'weekly', interval, weekday, end? } |
// { type: 'semimonthly', slots: [{day}|{nth,weekday}, ...], end? } |
// { type: 'monthly', interval, day?|nth+weekday, end? } | { type: 'yearly', end? }
// Legacy strings: 'weekly', 'biweekly', 'monthly', 'yearly', 'weekly:N',
// 'biweekly:N', 'monthly:N'.

function parseRule(freq) {
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
  if (dayNum > new Date(y, m + 1, 0).getDate()) return null;
  return new Date(y, m, dayNum);
}

function endOfDay(iso) {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d;
}

// First occurrence strictly after `after`; `anchor` = the original expense
// date (fixes biweekly phase, implicit day/weekday, yearly anniversary).
// Returns null when the rule has ended.
function nextOccurrence(freqOrRule, after, anchor) {
  const rule = typeof freqOrRule === 'string' ? parseRule(freqOrRule) : freqOrRule;
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
    const weekday = rule.weekday != null ? rule.weekday : anc.getDay();
    const cycle = 7 * (rule.interval || 1);
    const phase = new Date(anc);
    let delta = (weekday - phase.getDay() + 7) % 7;
    if (delta === 0) delta = cycle;
    phase.setDate(phase.getDate() + delta);
    while (phase <= a) phase.setDate(phase.getDate() + cycle);
    return gate(phase);
  }

  if (rule.type === 'monthly') {
    const interval = rule.interval || 1;
    for (let k = 0; k < 600; k++) {
      const mIndex = anc.getMonth() + k * interval;
      const y = anc.getFullYear() + Math.floor(mIndex / 12);
      const m = ((mIndex % 12) + 12) % 12;
      let occ;
      if (rule.nth != null) {
        occ = nthWeekdayOfMonth(y, m, rule.nth, rule.weekday);
        if (!occ) continue;
      } else {
        occ = new Date(y, m, clampDay(y, m, rule.day != null ? rule.day : anc.getDate()));
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

// --- Auth middleware ---

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Auth route ---

app.post('/auth/apple', async (req, res) => {
  try {
    const { identityToken, email } = req.body;
    if (!identityToken) {
      return res.status(400).json({ error: 'identityToken is required' });
    }

    const audience = [APPLE_BUNDLE_ID, 'host.exp.Exponent'];
    const applePayload = await appleSignin.verifyIdToken(identityToken, {
      audience,
      ignoreExpiration: false,
    });

    const appleId = applePayload.sub;
    const user = await prisma.user.upsert({
      where: { appleId },
      update: {},
      create: {
        appleId,
        email: email ?? null,
        categories: JSON.stringify(DEFAULT_CATEGORIES),
      },
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.error('Apple auth error:', err);
    res.status(401).json({ error: 'Apple authentication failed' });
  }
});

// --- Category routes ---

app.get('/categories', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const categories = user?.categories ? JSON.parse(user.categories) : [];
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.put('/categories', requireAuth, async (req, res) => {
  try {
    const { categories } = req.body;
    await prisma.user.update({
      where: { id: req.userId },
      data: { categories: JSON.stringify(categories) },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save categories' });
  }
});

// --- Expense routes ---

// GET /expenses
app.get('/expenses', requireAuth, async (req, res) => {
  try {
    const { range, category, recurring, upcoming } = req.query;
    const where = { userId: req.userId };

    if (range) {
      const now = new Date();
      const from = new Date();
      if (range === 'day') from.setHours(0, 0, 0, 0);
      else if (range === 'week') {
        from.setDate(now.getDate() - now.getDay()); // back to Sunday
        from.setHours(0, 0, 0, 0);
      }
      else if (range === 'month') from.setDate(1), from.setHours(0, 0, 0, 0);
      where.date = { gte: from };
    }

    if (req.query.from || req.query.to) {
      where.date = {};
      if (req.query.from) where.date.gte = new Date(req.query.from);
      if (req.query.to)   where.date.lte = new Date(req.query.to);
    }

    if (category) where.category = category;
    if (recurring === 'true') where.isRecurring = true;
    if (upcoming === 'true') {
      where.date = { ...(where.date || {}), gt: new Date() };
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// GET /expenses/latest-date — returns the latest expense date for the user (including future)
app.get('/expenses/latest-date', requireAuth, async (req, res) => {
  try {
    const latest = await prisma.expense.findFirst({
      where: { userId: req.userId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    res.json({ date: latest?.date ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch latest date' });
  }
});

// GET /expenses/summary
app.get('/expenses/summary', requireAuth, async (req, res) => {
  try {
    const { range, from: fromParam, to: toParam } = req.query;

    let from;
    if (fromParam) {
      from = new Date(fromParam);
    } else {
      from = new Date();
      if (range === 'day') from.setHours(0, 0, 0, 0);
      else if (range === 'week') {
        from.setDate(from.getDate() - from.getDay()); // back to Sunday
        from.setHours(0, 0, 0, 0);
      }
      else if (range === 'month') from.setDate(1), from.setHours(0, 0, 0, 0);
      else from.setFullYear(2000);
    }

    const dateFilter = { gte: from };
    if (toParam) dateFilter.lte = new Date(toParam);

    // Exclude expenses beyond today from summary totals (but include all of today)
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (!dateFilter.lte || dateFilter.lte > endOfToday) dateFilter.lte = endOfToday;

    const expenses = await prisma.expense.findMany({
      where: { userId: req.userId, date: dateFilter },
    });

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const byCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {});

    res.json({ total, byCategory, count: expenses.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// POST /expenses
app.post('/expenses', requireAuth, async (req, res) => {
  try {
    const { title, category, amount, date, isRecurring, recurringFreq, recurringAutoAdd } = req.body;

    if (!title || !category || amount == null) {
      return res.status(400).json({ error: 'title, category, and amount are required' });
    }

    const expenseDate = date ? new Date(date) : new Date();
    const recurring = !!isRecurring;
    const autoAdd = !!recurringAutoAdd;
    const nextDueDate = recurring && recurringFreq
      ? nextOccurrence(recurringFreq, expenseDate, expenseDate)
      : null;

    const expense = await prisma.expense.create({
      data: {
        title,
        category,
        amount: parseFloat(amount),
        date: expenseDate,
        userId: req.userId,
        isRecurring: recurring,
        recurringFreq: recurring ? recurringFreq : null,
        recurringAutoAdd: autoAdd,
        nextDueDate,
      },
    });

    res.status(201).json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// PATCH /expenses/:id
app.patch('/expenses/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, category, amount, date, isRecurring, recurringFreq, recurringAutoAdd } = req.body;

    const existing = await prisma.expense.findFirst({ where: { id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Expense not found' });

    const expenseDate = date ? new Date(date) : existing.date;
    const recurring = isRecurring != null ? !!isRecurring : existing.isRecurring;
    const freq = recurringFreq !== undefined ? recurringFreq : existing.recurringFreq;
    const autoAdd = recurringAutoAdd != null ? !!recurringAutoAdd : existing.recurringAutoAdd;
    const nextDueDate = recurring && freq ? nextOccurrence(freq, expenseDate, expenseDate) : null;

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(category && { category }),
        ...(amount != null && { amount: parseFloat(amount) }),
        date: expenseDate,
        isRecurring: recurring,
        recurringFreq: recurring ? freq : null,
        recurringAutoAdd: autoAdd,
        nextDueDate,
      },
    });

    res.json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// DELETE /expenses/:id
app.delete('/expenses/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.expense.findFirst({ where: { id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Expense not found' });

    await prisma.expense.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// --- Recurring auto-add cron (runs daily at midnight UTC) ---

cron.schedule('0 0 * * *', async () => {
  console.log('[cron] Checking recurring expenses...');
  try {
    const now = new Date();
    const due = await prisma.expense.findMany({
      where: {
        isRecurring: true,
        recurringAutoAdd: true,
        nextDueDate: { lte: now },
      },
    });

    for (const e of due) {
      const newDate = e.nextDueDate;
      // May be null when the rule has an end date and no occurrences remain —
      // the original keeps nextDueDate null and never fires again.
      const nextDueDate = nextOccurrence(e.recurringFreq, newDate, e.date);

      // Create the new instance as a plain (non-scheduling) copy. It keeps the
      // ↻ badge via isRecurring, but only the ORIGINAL row schedules future
      // adds — copies with autoAdd would double up every cycle.
      await prisma.expense.create({
        data: {
          title: e.title,
          category: e.category,
          amount: e.amount,
          date: newDate,
          userId: e.userId,
          isRecurring: true,
          recurringFreq: e.recurringFreq,
          recurringAutoAdd: false,
          nextDueDate: null,
        },
      });

      // Advance the original's nextDueDate (or park it if the rule ended)
      await prisma.expense.update({
        where: { id: e.id },
        data: { nextDueDate },
      });

      console.log(`[cron] Auto-added recurring expense: ${e.title} for user ${e.userId}`);
    }
  } catch (err) {
    console.error('[cron] Error processing recurring expenses:', err);
  }
});

// One-time repair for the pre-2.2 cron bug where auto-added copies were
// themselves created with recurringAutoAdd: true — each cycle every copy
// spawned another scheduler. Keep the earliest row of each identical group
// as the scheduler; demote the rest to plain entries. Idempotent.
async function cleanupDuplicateSchedulers() {
  const scheds = await prisma.expense.findMany({
    where: { isRecurring: true, recurringAutoAdd: true },
    orderBy: { date: 'asc' },
  });
  const seen = new Set();
  const demote = [];
  for (const e of scheds) {
    const key = [e.userId, e.title, e.amount, e.category, e.recurringFreq].join('|');
    if (seen.has(key)) demote.push(e.id);
    else seen.add(key);
  }
  if (demote.length) {
    await prisma.expense.updateMany({
      where: { id: { in: demote } },
      data: { recurringAutoAdd: false, nextDueDate: null },
    });
    console.log(`[repair] Demoted ${demote.length} duplicate recurring scheduler row(s)`);
  }
}
cleanupDuplicateSchedulers().catch((e) => console.error('[repair] failed:', e));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

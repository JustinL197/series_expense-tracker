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

// --- Helpers ---

function calcNextDueDate(fromDate, freq) {
  const d = new Date(fromDate);
  if (freq === 'weekly')  d.setDate(d.getDate() + 7);
  if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  if (freq === 'yearly')  d.setFullYear(d.getFullYear() + 1);
  return d;
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
      else if (range === 'week') from.setDate(now.getDate() - 7);
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
      else if (range === 'week') from.setDate(from.getDate() - 7);
      else if (range === 'month') from.setDate(1), from.setHours(0, 0, 0, 0);
      else from.setFullYear(2000);
    }

    const dateFilter = { gte: from };
    if (toParam) dateFilter.lte = new Date(toParam);

    // Exclude future expenses from summary totals
    const now = new Date();
    if (!dateFilter.lte || dateFilter.lte > now) dateFilter.lte = now;

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
      ? calcNextDueDate(expenseDate, recurringFreq)
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
    const nextDueDate = recurring && freq ? calcNextDueDate(expenseDate, freq) : null;

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
      const nextDueDate = calcNextDueDate(newDate, e.recurringFreq);

      // Create new instance
      await prisma.expense.create({
        data: {
          title: e.title,
          category: e.category,
          amount: e.amount,
          date: newDate,
          userId: e.userId,
          isRecurring: true,
          recurringFreq: e.recurringFreq,
          recurringAutoAdd: true,
          nextDueDate,
        },
      });

      // Advance the original's nextDueDate
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

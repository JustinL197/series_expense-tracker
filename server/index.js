require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const appleSignin = require('apple-signin-auth');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID;

app.use(cors());
app.use(express.json());

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

// POST /auth/apple
// Body: { identityToken: string, email?: string }
app.post('/auth/apple', async (req, res) => {
  try {
    const { identityToken, email } = req.body;
    if (!identityToken) {
      return res.status(400).json({ error: 'identityToken is required' });
    }

    const applePayload = await appleSignin.verifyIdToken(identityToken, {
      audience: APPLE_BUNDLE_ID,
      ignoreExpiration: false,
    });

    const appleId = applePayload.sub;

    const user = await prisma.user.upsert({
      where: { appleId },
      update: {},
      create: { appleId, email: email ?? null },
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.error('Apple auth error:', err);
    res.status(401).json({ error: 'Apple authentication failed', detail: err?.message });
  }
});

// --- Expense routes (all require auth) ---

// GET /expenses — optional ?range=day|week|month and ?category=
app.get('/expenses', requireAuth, async (req, res) => {
  try {
    const { range, category } = req.query;
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
      if (req.query.to) where.date.lte = new Date(req.query.to);
    }

    if (category) {
      where.category = category;
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
    const { range } = req.query;
    const now = new Date();
    const from = new Date();

    if (range === 'day') from.setHours(0, 0, 0, 0);
    else if (range === 'week') from.setDate(now.getDate() - 7);
    else if (range === 'month') from.setDate(1), from.setHours(0, 0, 0, 0);
    else from.setFullYear(2000);

    const expenses = await prisma.expense.findMany({
      where: { userId: req.userId, date: { gte: from } },
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
    const { title, category, amount, date } = req.body;

    if (!title || !category || amount == null) {
      return res.status(400).json({ error: 'title, category, and amount are required' });
    }

    const expense = await prisma.expense.create({
      data: {
        title,
        category,
        amount: parseFloat(amount),
        date: date ? new Date(date) : new Date(),
        userId: req.userId,
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
    const { title, category, amount, date } = req.body;

    // Verify ownership before updating
    const existing = await prisma.expense.findFirst({ where: { id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Expense not found' });

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(category && { category }),
        ...(amount != null && { amount: parseFloat(amount) }),
        ...(date && { date: new Date(date) }),
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

    // Verify ownership before deleting
    const existing = await prisma.expense.findFirst({ where: { id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Expense not found' });

    await prisma.expense.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

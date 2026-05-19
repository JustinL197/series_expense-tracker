require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// GET all expenses, optional ?range=day|week|month
app.get('/expenses', async (req, res) => {
  try {
    const { range, category } = req.query;
    const where = {};

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

// GET summary total for a range
app.get('/expenses/summary', async (req, res) => {
  try {
    const { range } = req.query;
    const now = new Date();
    const from = new Date();

    if (range === 'day') from.setHours(0, 0, 0, 0);
    else if (range === 'week') from.setDate(now.getDate() - 7);
    else if (range === 'month') from.setDate(1), from.setHours(0, 0, 0, 0);
    else from.setFullYear(2000);

    const expenses = await prisma.expense.findMany({
      where: { date: { gte: from } },
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

// POST create expense
app.post('/expenses', async (req, res) => {
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
      },
    });

    res.status(201).json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// PATCH update expense
app.patch('/expenses/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, category, amount, date } = req.body;

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

// DELETE expense
app.delete('/expenses/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.expense.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: 'Expense not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

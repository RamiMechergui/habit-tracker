const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Expense = require('../models/Expense');
const User = require('../models/User');

// GET /api/expenses
router.get('/', protect, async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.user._id.toString() }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/expenses/:date
router.get('/:date', protect, async (req, res) => {
  try {
    const expense = await Expense.findOne({ userId: req.user._id.toString(), date: req.params.date });
    res.json(expense || { date: req.params.date, expenses: [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/expenses — create or update for a date
router.post('/', protect, async (req, res) => {
  try {
    const { date, expenses } = req.body;
    if (!date) return res.status(400).json({ message: 'Date is required' });

    const expense = await Expense.findOneAndUpdate(
      { userId: req.user._id.toString(), date },
      { expenses: expenses || [] },
      { upsert: true, new: true }
    );
    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/expenses/:date
router.put('/:date', protect, async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { userId: req.user._id.toString(), date: req.params.date },
      { expenses: req.body.expenses || [] },
      { upsert: true, new: true }
    );
    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/expenses/:date
router.delete('/:date', protect, async (req, res) => {
  try {
    await Expense.findOneAndDelete({ userId: req.user._id.toString(), date: req.params.date });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/expenses/categories/list  (also aliased to /api/categories via server.js)
router.get('/categories/list', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('expenseCategories');
    res.json({ expenseCategories: user.expenseCategories || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/expenses/categories
router.post('/categories', protect, async (req, res) => {
  try {
    const { category } = req.body;
    if (!category?.trim()) return res.status(400).json({ message: 'Category name required' });
    const user = await User.findById(req.user._id);
    if (!user.expenseCategories.includes(category.trim())) {
      user.expenseCategories.push(category.trim());
      await user.save();
    }
    res.json({ categories: user.expenseCategories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/expenses/categories/:category
router.delete('/categories/:category', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.expenseCategories = user.expenseCategories.filter(
      c => c !== decodeURIComponent(req.params.category)
    );
    await user.save();
    res.json({ categories: user.expenseCategories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
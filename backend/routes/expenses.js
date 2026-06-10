const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Expense = require('../models/Expense');

// GET all expenses for user
router.get('/', protect, async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.user._id.toString() }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET expenses by date
router.get('/:date', protect, async (req, res) => {
  try {
    const expense = await Expense.findOne({ userId: req.user._id.toString(), date: req.params.date });
    res.json(expense || { date: req.params.date, expenses: [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create or update expense for a date
router.post('/', protect, async (req, res) => {
  try {
    const { date, expenses } = req.body;
    if (!date) return res.status(400).json({ message: 'Date is required' });

    let expense = await Expense.findOne({ userId: req.user._id.toString(), date });
    if (expense) {
      expense.expenses = expenses || [];
      await expense.save();
    } else {
      expense = await Expense.create({ userId: req.user._id.toString(), date, expenses: expenses || [] });
    }
    res.json(expense);
  } catch (err) {
    if (err.code === 11000) {
      const { date, expenses } = req.body;
      let expense = await Expense.findOne({ userId: req.user._id.toString(), date });
      expense.expenses = expenses || [];
      await expense.save();
      res.json(expense);
    } else {
      res.status(500).json({ message: err.message });
    }
  }
});

// PUT update expense for a date
router.put('/:date', protect, async (req, res) => {
  try {
    const { date } = req.params;
    const { expenses } = req.body;
    const expense = await Expense.findOneAndUpdate(
      { userId: req.user._id.toString(), date },
      { expenses: expenses || [] },
      { new: true, upsert: true }
    );
    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE expense for a date
router.delete('/:date', protect, async (req, res) => {
  try {
    await Expense.findOneAndDelete({ userId: req.user._id.toString(), date: req.params.date });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET expense categories for user
router.get('/categories/list', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id).select('expenseCategories');
    res.json({ expenseCategories: user.expenseCategories || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Alias: GET /categories matches /categories/list (the frontend calls /api/categories)
router.get('/categories', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id).select('expenseCategories');
    res.json({ categories: user.expenseCategories || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST add expense category
router.post('/categories', protect, async (req, res) => {
  try {
    const { category } = req.body;
    if (!category?.trim()) return res.status(400).json({ message: 'Category name required' });

    const User = require('../models/User');
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

// DELETE expense category
router.delete('/categories/:category', protect, async (req, res) => {
  try {
    const { category } = req.params;
    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    user.expenseCategories = user.expenseCategories.filter(c => c !== decodeURIComponent(category));
    await user.save();
    res.json({ categories: user.expenseCategories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
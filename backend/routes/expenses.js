const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAllExpenses,
  getExpenseByDate,
  upsertExpense,
  deleteExpense,
} = require('../db/expenses');
const { getUserById, updateUser } = require('../db/users');

// GET /api/expenses
router.get('/', protect, async (req, res) => {
  try {
    const expenses = await getAllExpenses(req.user.userId);
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/expenses/categories/list  (must come BEFORE /:date to avoid conflict)
router.get('/categories/list', protect, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);
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
    const user = await getUserById(req.user.userId);
    if (!user.expenseCategories.includes(category.trim())) {
      const updated = await updateUser(req.user.userId, {
        expenseCategories: [...user.expenseCategories, category.trim()],
      });
      return res.json({ expenseCategories: updated.expenseCategories });
    }
    res.json({ expenseCategories: user.expenseCategories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/expenses/categories/:category
router.put('/categories/:category', protect, async (req, res) => {
  try {
    const { newCategory } = req.body;
    if (!newCategory?.trim()) return res.status(400).json({ message: 'New category name required' });
    const user   = await getUserById(req.user.userId);
    const oldCat = decodeURIComponent(req.params.category);
    if (user.expenseCategories.includes(newCategory.trim()) && newCategory.trim() !== oldCat) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    const updated = await updateUser(req.user.userId, {
      expenseCategories: user.expenseCategories.map(c => c === oldCat ? newCategory.trim() : c),
    });
    res.json({ expenseCategories: updated.expenseCategories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/expenses/categories/:category
router.delete('/categories/:category', protect, async (req, res) => {
  try {
    const user    = await getUserById(req.user.userId);
    const cat     = decodeURIComponent(req.params.category);
    const updated = await updateUser(req.user.userId, {
      expenseCategories: user.expenseCategories.filter(c => c !== cat),
    });
    res.json({ expenseCategories: updated.expenseCategories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/expenses/:date
router.get('/:date', protect, async (req, res) => {
  try {
    const expense = await getExpenseByDate(req.user.userId, req.params.date);
    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/expenses — create or update for a date
router.post('/', protect, async (req, res) => {
  try {
    const { date, expenses } = req.body;
    if (!date) return res.status(400).json({ message: 'Date is required' });
    const result = await upsertExpense(req.user.userId, date, expenses || []);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/expenses/:date
router.put('/:date', protect, async (req, res) => {
  try {
    const result = await upsertExpense(req.user.userId, req.params.date, req.body.expenses || []);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/expenses/:date
router.delete('/:date', protect, async (req, res) => {
  try {
    await deleteExpense(req.user.userId, req.params.date);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
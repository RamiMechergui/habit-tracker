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

// ── Category helpers ─────────────────────────────────────────────────────────
// Categories are stored as objects: { name: string, icon: string }
// Legacy data may be plain strings — normalise on every read.

function normalizeCategory(cat) {
  if (cat && typeof cat === 'object' && cat.name) return { name: cat.name, icon: cat.icon || '📦' };
  return { name: String(cat), icon: '📦' };
}

function normalizeCategoryList(cats) {
  if (!Array.isArray(cats)) return [];
  return cats.map(normalizeCategory);
}

function getCatName(cat) {
  return normalizeCategory(cat).name;
}

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
    res.json({ expenseCategories: normalizeCategoryList(user.expenseCategories) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/expenses/categories
// Body: { category: { name: string, icon: string } }
router.post('/categories', protect, async (req, res) => {
  try {
    const raw = req.body.category;
    if (!raw) return res.status(400).json({ message: 'Category required' });

    const newCat = normalizeCategory(raw);
    if (!newCat.name?.trim()) return res.status(400).json({ message: 'Category name required' });
    newCat.name = newCat.name.trim();

    const user = await getUserById(req.user.userId);
    const existing = normalizeCategoryList(user.expenseCategories);

    // Prevent duplicates (by name)
    if (existing.some(c => c.name === newCat.name)) {
      return res.json({ expenseCategories: existing });
    }

    const updated = await updateUser(req.user.userId, {
      expenseCategories: [...existing, newCat],
    });
    return res.json({ expenseCategories: normalizeCategoryList(updated.expenseCategories) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/expenses/categories/:category
// Body: { newCategory: string, icon: string }
router.put('/categories/:category', protect, async (req, res) => {
  try {
    const { newCategory, icon } = req.body;
    if (!newCategory?.trim()) return res.status(400).json({ message: 'New category name required' });

    const user   = await getUserById(req.user.userId);
    const oldName = decodeURIComponent(req.params.category);
    const existing = normalizeCategoryList(user.expenseCategories);

    const newName = newCategory.trim();
    const updatedIcon = icon || '📦';

    // Prevent renaming to an existing name (unless it's the same category)
    if (existing.some(c => c.name === newName) && newName !== oldName) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    const updatedList = existing.map(c =>
      c.name === oldName ? { name: newName, icon: updatedIcon } : c
    );

    const updated = await updateUser(req.user.userId, { expenseCategories: updatedList });
    res.json({ expenseCategories: normalizeCategoryList(updated.expenseCategories) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/expenses/categories/:category
router.delete('/categories/:category', protect, async (req, res) => {
  try {
    const user  = await getUserById(req.user.userId);
    const name  = decodeURIComponent(req.params.category);
    const existing = normalizeCategoryList(user.expenseCategories);

    const updated = await updateUser(req.user.userId, {
      expenseCategories: existing.filter(c => c.name !== name),
    });
    res.json({ expenseCategories: normalizeCategoryList(updated.expenseCategories) });
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
    const { date, expenses, income } = req.body;
    if (!date) return res.status(400).json({ message: 'Date is required' });
    const result = await upsertExpense(req.user.userId, date, expenses || [], income);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/expenses/:date
router.put('/:date', protect, async (req, res) => {
  try {
    const result = await upsertExpense(req.user.userId, req.params.date, req.body.expenses || [], req.body.income);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/expenses/income — save income entries for a date
router.post('/income', protect, async (req, res) => {
  try {
    const { date, income } = req.body;
    if (!date) return res.status(400).json({ message: 'Date is required' });
    const existing = await getExpenseByDate(req.user.userId, date);
    const result = await upsertExpense(req.user.userId, date, existing.expenses, income || []);
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
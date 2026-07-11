const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getAll, createItem, updateItem, deleteItem } = require('../db/milestones');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const items = await getAll(req.user.userId);
    res.json(items);
  } catch (err) {
    console.error('[Milestones] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch milestones' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { habitName, lastDate } = req.body;
    if (!habitName || !habitName.trim()) {
      return res.status(400).json({ message: 'Habit name is required' });
    }
    if (!lastDate) {
      return res.status(400).json({ message: 'Last date is required' });
    }
    const item = await createItem(req.user.userId, { habitName: habitName.trim(), lastDate });
    res.status(201).json(item);
  } catch (err) {
    console.error('[Milestones] POST error:', err);
    res.status(500).json({ message: err.message || 'Failed to create milestone' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { habitName, lastDate } = req.body;
    const updates = {};
    if (habitName !== undefined) updates.habitName = habitName.trim();
    if (lastDate !== undefined) updates.lastDate = lastDate;
    const item = await updateItem(req.user.userId, req.params.id, updates);
    if (!item) return res.status(404).json({ message: 'Milestone not found' });
    res.json(item);
  } catch (err) {
    console.error('[Milestones] PUT error:', err);
    res.status(500).json({ message: err.message || 'Failed to update milestone' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteItem(req.user.userId, req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Milestone not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[Milestones] DELETE error:', err);
    res.status(500).json({ message: 'Failed to delete milestone' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// GET /api/essentials
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('essentials');
    res.json(user.essentials || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/essentials
router.post('/', protect, async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Item name is required' });
    const user = await User.findById(req.user._id);
    user.essentials.push({ name: name.trim(), icon: icon || '🧴', status: 'A', lastUpdated: new Date() });
    await user.save();
    res.status(201).json(user.essentials[user.essentials.length - 1]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/essentials/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const { name, icon, status } = req.body;
    const user = await User.findById(req.user._id);
    const item = user.essentials.id(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (status !== undefined && !['A', 'BS', 'NA'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    if (name !== undefined) item.name = name.trim();
    if (icon !== undefined) item.icon = icon;
    if (status !== undefined) item.status = status;
    item.lastUpdated = new Date();
    await user.save();
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/essentials/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const item = user.essentials.id(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    item.deleteOne();
    await user.save();
    res.json({ message: 'Item deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

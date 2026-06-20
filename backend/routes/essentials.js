const express = require('express');
const router  = express.Router();
const { protect }               = require('../middleware/auth');
const { getUserById, updateUser } = require('../db/users');
const { randomUUID }            = require('crypto');

// GET /api/essentials
router.get('/', protect, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);
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

    const user        = await getUserById(req.user.userId);
    const essentialId = randomUUID();
    const newItem     = {
      essentialId,
      _id:         essentialId,
      name:        name.trim(),
      icon:        icon || '🧴',
      status:      'A',
      lastUpdated: new Date().toISOString(),
    };
    const essentials = [...(user.essentials || []), newItem];
    await updateUser(req.user.userId, { essentials });
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/essentials/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const { name, icon, status } = req.body;
    if (status !== undefined && !['A', 'BS', 'NA'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await getUserById(req.user.userId);
    const idx  = (user.essentials || []).findIndex(
      e => e.essentialId === req.params.id || e._id === req.params.id
    );
    if (idx === -1) return res.status(404).json({ message: 'Item not found' });

    const essentials = [...(user.essentials || [])];
    const item       = { ...essentials[idx] };
    if (name   !== undefined) item.name   = name.trim();
    if (icon   !== undefined) item.icon   = icon;
    if (status !== undefined) item.status = status;
    item.lastUpdated = new Date().toISOString();
    essentials[idx]  = item;

    await updateUser(req.user.userId, { essentials });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/essentials/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);
    const essentials = (user.essentials || []).filter(
      e => e.essentialId !== req.params.id && e._id !== req.params.id
    );
    if (essentials.length === (user.essentials || []).length) {
      return res.status(404).json({ message: 'Item not found' });
    }
    await updateUser(req.user.userId, { essentials });
    res.json({ message: 'Item deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

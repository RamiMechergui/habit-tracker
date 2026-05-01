const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

// GET /api/notifications  — list with optional ?status=UNREAD|READ  &limit=50  &skip=0
router.get('/', protect, async (req, res) => {
  try {
    const { status, limit = 100, skip = 0 } = req.query;
    const filter = { userId: req.user._id.toString() };
    if (status && ['UNREAD', 'READ'].includes(status)) filter.status = status;

    const [notifications, total] = await Promise.all([
      Notification.find(filter).sort({ timestamp: -1 }).skip(Number(skip)).limit(Number(limit)),
      Notification.countDocuments(filter)
    ]);
    res.json({ notifications, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/notifications/count — unread badge count
router.get('/count', protect, async (req, res) => {
  try {
    const unread = await Notification.countDocuments({
      userId: req.user._id.toString(),
      status: 'UNREAD'
    });
    res.json({ unread });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/notifications/read-all — mark all UNREAD → READ  (must be before /:id)
router.put('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id.toString(), status: 'UNREAD' },
      { status: 'READ' }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/notifications/:id/read — mark single notification as READ
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id.toString() },
      { status: 'READ' },
      { new: true }
    );
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    res.json(notif);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/notifications/:id — remove a notification
router.delete('/:id', protect, async (req, res) => {
  try {
    await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id.toString()
    });
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

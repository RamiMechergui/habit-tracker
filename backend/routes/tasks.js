const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Notification = require('../models/Notification');
const ScheduledReminder = require('../models/ScheduledReminder');

// ── POST /api/tasks/remind ────────────────────────────────────────────────────
// Schedule a reminder for a task.
// Body: { taskId, taskTitle, taskTime, reminderMinutes, date }
router.post('/remind', protect, async (req, res) => {
  try {
    const { taskId, taskTitle, taskTime, reminderMinutes = 15, date } = req.body;
    if (!taskId || !taskTitle || !taskTime || !date) {
      return res.status(400).json({ message: 'taskId, taskTitle, taskTime, date are required.' });
    }

    // Calculate fireAt
    const [h, m] = taskTime.split(':').map(Number);
    const [y, mo, d] = date.split('-').map(Number);
    const taskStart = new Date(y, mo - 1, d, h, m, 0, 0);
    const fireAt    = new Date(taskStart.getTime() - reminderMinutes * 60000);

    if (fireAt <= new Date()) {
      return res.status(400).json({ message: 'Reminder time is in the past.' });
    }

    // Upsert reminder (replace any existing for this task)
    await ScheduledReminder.findOneAndUpdate(
      { userId: req.user._id.toString(), taskId, date },
      {
        userId: req.user._id.toString(),
        taskId, taskTitle, date, fireAt,
        reminderMinutes, fired: false
      },
      { upsert: true, new: true }
    );

    res.json({ message: 'Reminder scheduled', fireAt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/tasks/remind/:taskId ─────────────────────────────────────────
// Cancel a reminder for a specific task.
router.delete('/remind/:taskId', protect, async (req, res) => {
  try {
    await ScheduledReminder.deleteMany({
      userId: req.user._id.toString(),
      taskId: req.params.taskId
    });
    res.json({ message: 'Reminder cancelled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/tasks/remind ─────────────────────────────────────────────────────
// List pending reminders for the current user (for debugging / UI display).
router.get('/remind', protect, async (req, res) => {
  try {
    const reminders = await ScheduledReminder.find({
      userId: req.user._id.toString(),
      fired: false,
      fireAt: { $gt: new Date() }
    }).sort({ fireAt: 1 }).limit(50);
    res.json({ reminders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

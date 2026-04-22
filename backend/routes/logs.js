const express = require('express');
const router = express.Router();
const Log = require('../models/Log');
const { protect } = require('../middleware/auth');

// Get logs for an array of dates or month (we can simply fetch all logs for user and filter on frontend, 
// or implement a date range. Since frontend uses `getLog` per date, we can fetch all logs on initial load or by date).
// Let's create an endpoint to get all logs for the authenticated user.
router.get('/', protect, async (req, res) => {
  try {
    const logs = await Log.find({ userId: req.user._id });
    // Transform into a fast lookup dictionary format for frontend
    const logsObj = {};
    logs.forEach(l => {
      logsObj[l.date] = l.data;
    });
    res.json(logsObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update or create a log for a specific date
router.post('/:date', protect, async (req, res) => {
  try {
    const { date } = req.params;
    const data = req.body;

    let log = await Log.findOne({ userId: req.user._id, date });

    if (log) {
      log.data = data;
      await log.save();
    } else {
      log = await Log.create({ userId: req.user._id, date, data });
    }

    res.json(log.data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

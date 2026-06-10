const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Analytics = require('../models/Analytics');
const User = require('../models/User');

// GET analytics for user (optional date range)
router.get('/', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { userId: req.user._id.toString() };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = startDate;
      if (endDate) filter.date.$lte = endDate;
    }
    const analytics = await Analytics.find(filter).sort({ date: 1 });
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET analytics for specific date
router.get('/:date', protect, async (req, res) => {
  try {
    const analytic = await Analytics.findOne({ userId: req.user._id.toString(), date: req.params.date });
    res.json(analytic || null);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST calculate/update analytics for a date (triggered by scoring service or frontend)
router.post('/calculate/:date', protect, async (req, res) => {
  try {
    const { date } = req.params;
    const user = await User.findById(req.user._id);
    
    // This is a placeholder - actual scoring logic would be here
    // For now, we just return the existing or create empty
    let analytic = await Analytics.findOne({ userId: req.user._id.toString(), date });
    if (!analytic) {
      analytic = await Analytics.create({ userId: req.user._id.toString(), date, totalScore: 0, rank: 'F', totalExpenses: 0, bookPages: 0 });
    }
    res.json(analytic);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
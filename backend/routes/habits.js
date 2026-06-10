const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const MorningHabit = require('../models/MorningHabit');
const NightHabit = require('../models/NightHabit');
const BadHabit = require('../models/BadHabit');
const WeekendDuty = require('../models/WeekendDuty');
const SideHustle = require('../models/SideHustle');
const SystemCheck = require('../models/SystemCheck');
const BookReading = require('../models/BookReading');
const VideoEditing = require('../models/VideoEditing');

const HABIT_MODELS = {
  'morning': MorningHabit,
  'night': NightHabit,
  'bad': BadHabit,
  'weekend': WeekendDuty,
  'side-hustle': SideHustle,
  'system-check': SystemCheck,
  'book-reading': BookReading,
  'video-editing': VideoEditing
};

function getModel(type) {
  const model = HABIT_MODELS[type];
  if (!model) {
    throw new Error(`Invalid habit type: ${type}`);
  }
  return model;
}

// Generic CRUD for all habit types
const habitTypes = Object.keys(HABIT_MODELS);

habitTypes.forEach(type => {
  const Model = HABIT_MODELS[type];
  const basePath = `/${type}`;

  // GET all for user
  router.get(basePath, protect, async (req, res) => {
    try {
      const habits = await Model.find({ userId: req.user._id.toString() }).sort({ date: -1 });
      res.json(habits);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET by date
  router.get(`${basePath}/:date`, protect, async (req, res) => {
    try {
      const habit = await Model.findOne({ userId: req.user._id.toString(), date: req.params.date });
      res.json(habit || null);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST create or update
  router.post(basePath, protect, async (req, res) => {
    try {
      const { date, ...data } = req.body;
      if (!date) return res.status(400).json({ message: 'Date is required' });

      let habit = await Model.findOne({ userId: req.user._id.toString(), date });
      if (habit) {
        Object.assign(habit, data);
        await habit.save();
      } else {
        habit = await Model.create({ userId: req.user._id.toString(), date, ...data });
      }
      res.json(habit);
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate key - update instead
        const { date, ...data } = req.body;
        let habit = await Model.findOne({ userId: req.user._id.toString(), date });
        Object.assign(habit, data);
        await habit.save();
        res.json(habit);
      } else {
        res.status(500).json({ message: err.message });
      }
    }
  });

  // PUT update
  router.put(`${basePath}/:date`, protect, async (req, res) => {
    try {
      const { date } = req.params;
      const habit = await Model.findOneAndUpdate(
        { userId: req.user._id.toString(), date },
        req.body,
        { new: true, upsert: true }
      );
      res.json(habit);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE
  router.delete(`${basePath}/:date`, protect, async (req, res) => {
    try {
      await Model.findOneAndDelete({ userId: req.user._id.toString(), date: req.params.date });
      res.json({ message: 'Deleted' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
});

module.exports = router;
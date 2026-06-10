const mongoose = require('mongoose');

const morningHabitSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  wakeTime: { type: String, default: '' },
  meditate: { type: Boolean, default: false },
  bed: { type: Boolean, default: false },
  teeth: { type: Boolean, default: false },
  shower: { type: Boolean, default: false },
  gel: { type: Boolean, default: false },
  perfume: { type: Boolean, default: false }
}, { timestamps: true });

morningHabitSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('MorningHabit', morningHabitSchema);
const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  totalScore: { type: Number, default: 0 },
  rank: { type: String, default: 'F' },
  totalExpenses: { type: Number, default: 0 },
  bookPages: { type: Number, default: 0 }
});

analyticsSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Analytics', analyticsSchema);
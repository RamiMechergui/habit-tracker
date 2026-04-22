const mongoose = require('mongoose');

const dailyLogSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

dailyLogSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyLog', dailyLogSchema);
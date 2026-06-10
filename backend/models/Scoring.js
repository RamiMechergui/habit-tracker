const mongoose = require('mongoose');

const scoringSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  score: { type: Number, default: 0 },
  breakdown: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

scoringSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Scoring', scoringSchema);
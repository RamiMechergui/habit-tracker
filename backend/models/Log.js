const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

// Ensure unique log per user per day
logSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Log', logSchema);

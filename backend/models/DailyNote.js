const mongoose = require('mongoose');

const dailyNoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  content: { type: String, required: true },
}, { timestamps: true });

// Optimize querying by user and date
dailyNoteSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('DailyNote', dailyNoteSchema);

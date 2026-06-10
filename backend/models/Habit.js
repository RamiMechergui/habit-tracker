const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['morning', 'night', 'bad', 'weekend', 'side-hustle', 'system-check', 'book-reading', 'video-editing'], required: true },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

habitSchema.index({ userId: 1, name: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Habit', habitSchema);
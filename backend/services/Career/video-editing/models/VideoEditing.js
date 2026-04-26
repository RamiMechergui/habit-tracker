const mongoose = require('mongoose');

const videoEditingSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  task: { type: String, default: '' },
  time: { type: String, default: '' },
  achieved: { type: Boolean, default: false },
  progress: { type: String, default: 'Same' },
  lessons: { type: [String], default: [] }
}, { timestamps: true });

videoEditingSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('VideoEditing', videoEditingSchema);

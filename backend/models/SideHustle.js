const mongoose = require('mongoose');

const sideHustleSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  task: { type: String, default: '' },
  time: { type: String, default: '' },
  achieved: { type: Boolean, default: false },
  lessons: { type: [String], default: [] }
}, { timestamps: true });

sideHustleSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('SideHustle', sideHustleSchema);
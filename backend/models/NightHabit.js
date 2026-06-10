const mongoose = require('mongoose');

const nightHabitSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  gym: { type: Boolean, default: false },
  cleanTable: { type: Boolean, default: false },
  orgTable: { type: Boolean, default: false },
  teeth: { type: Boolean, default: false },
  shave: { type: Boolean, default: false },
  washFace: { type: Boolean, default: false },
  hotShower: { type: Boolean, default: false },
  hygiene: { type: Boolean, default: false },
  fingerNails: { type: Boolean, default: false },
  toeNails: { type: Boolean, default: false },
  wiseSpend: { type: Boolean, default: false },
  saves: { type: Boolean, default: false },
  fillApp: { type: Boolean, default: false }
}, { timestamps: true });

nightHabitSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('NightHabit', nightHabitSchema);
const mongoose = require('mongoose');

const weekendDutySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  saturday: {
    preLaundry: { type: Boolean, default: false }
  },
  sunday: {
    cleanRoom: { type: Boolean, default: false },
    regularLaundry: { type: Boolean, default: false },
    shareBought: { type: Boolean, default: false }
  }
}, { timestamps: true });

weekendDutySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('WeekendDuty', weekendDutySchema);

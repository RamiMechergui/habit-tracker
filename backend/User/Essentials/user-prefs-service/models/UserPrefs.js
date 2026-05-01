const mongoose = require('mongoose');

const userPrefsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  notificationsEnabled: { type: Boolean, default: true },
  channels: {
    inApp: { type: Boolean, default: true },
    push:  { type: Boolean, default: false },
    email: { type: Boolean, default: false }
  },
  // 'instant' = notify immediately on status change
  // 'daily'   = batch into a single daily digest
  frequency: { type: String, enum: ['instant', 'daily'], default: 'instant' }
}, { timestamps: true });

module.exports = mongoose.model('UserPrefs', userPrefsSchema);

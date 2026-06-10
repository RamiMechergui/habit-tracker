const mongoose = require('mongoose');

const userPrefsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  notificationsEnabled: { type: Boolean, default: true },
  channels: {
    inApp: { type: Boolean, default: true },
    push:  { type: Boolean, default: false },
    email: { type: Boolean, default: false }
  },
  frequency: { type: String, enum: ['instant', 'daily'], default: 'instant' }
}, { timestamps: true });

module.exports = mongoose.model('UserPrefs', userPrefsSchema);
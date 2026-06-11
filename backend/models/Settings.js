const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  theme: { type: String, default: 'dark' },
  recurringTasks: { type: Object, default: {} },
  timelinePrefs: { type: Object, default: { defaultDuration: 30, intervalGranularity: 30 } }
});

module.exports = mongoose.model('Settings', settingsSchema);
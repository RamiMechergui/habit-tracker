const mongoose = require('mongoose');

const scheduledReminderSchema = new mongoose.Schema({
  userId:      { type: String, required: true, index: true },
  taskId:      { type: String, required: true },
  taskTitle:   { type: String, required: true },
  date:        { type: String, required: true },  // YYYY-MM-DD
  fireAt:      { type: Date,   required: true, index: true },
  fired:       { type: Boolean, default: false },
  reminderMinutes: { type: Number, default: 15 },
}, { timestamps: true });

scheduledReminderSchema.index({ fired: 1, fireAt: 1 });

module.exports = mongoose.model('ScheduledReminder', scheduledReminderSchema);

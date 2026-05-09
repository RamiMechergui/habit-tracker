const mongoose = require('mongoose');

// Notification model — supports both essentials alerts and task reminders
const notificationSchema = new mongoose.Schema({
  userId:       { type: String, required: true, index: true },
  // Essentials fields (optional — kept for backward compat)
  itemId:       { type: String },
  itemName:     { type: String },
  // Task reminder fields
  taskId:       { type: String },
  taskTitle:    { type: String },
  scheduledFor: { type: Date },
  // Common fields
  message:      { type: String, required: true },
  type: {
    type: String,
    enum: ['reminder', 'urgent', 'task_reminder', 'task_missed', 'task_delayed'],
    required: true
  },
  status:    { type: String, enum: ['UNREAD', 'READ'], default: 'UNREAD' },
  eventId:   { type: String, required: true, unique: true },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

notificationSchema.index({ userId: 1, status: 1, timestamp: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

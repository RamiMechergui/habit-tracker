const mongoose = require('mongoose');

// Shared Notification model for the monolithic server
// (mirrors notification-service/models/Notification.js)
const notificationSchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  itemId:    { type: String, required: true },
  itemName:  { type: String, required: true },
  message:   { type: String, required: true },
  type:      { type: String, enum: ['reminder', 'urgent'], required: true },
  status:    { type: String, enum: ['UNREAD', 'READ'], default: 'UNREAD' },
  eventId:   { type: String, required: true, unique: true },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

notificationSchema.index({ userId: 1, status: 1, timestamp: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

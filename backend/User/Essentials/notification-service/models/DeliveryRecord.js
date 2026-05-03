const mongoose = require('mongoose');

const deliveryRecordSchema = new mongoose.Schema({
  userId:         { type: String, required: true, index: true },
  notificationId: { type: String, required: true },
  channel:        { type: String, enum: ['in-app', 'push', 'email'], required: true },
  status:         { type: String, enum: ['delivered', 'failed'], default: 'delivered' },
  deliveredAt:    { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('DeliveryRecord', deliveryRecordSchema);

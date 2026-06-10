const mongoose = require('mongoose');

const deliveryRecordSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  eventId: { type: String, required: true, unique: true },
  channel: { type: String, enum: ['inApp', 'push', 'email'], required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['PENDING', 'SENT', 'FAILED'], default: 'PENDING' },
  attempts: { type: Number, default: 0 },
  error: { type: String, default: null }
}, { timestamps: true });

deliveryRecordSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('DeliveryRecord', deliveryRecordSchema);
const mongoose = require('mongoose');

const deliveryRecordSchema = new mongoose.Schema({
  userId:         { type: String, required: true, index: true },
  notificationId: { type: String, required: true },
  channel:        { type: String, enum: ['in-app', 'push', 'email'], default: 'in-app' },
  status:         { type: String, enum: ['delivered', 'failed', 'pending'], default: 'pending' },
  deliveredAt:    { type: Date },
  error:          { type: String }  // store failure reason if status = 'failed'
}, { timestamps: true });

deliveryRecordSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('DeliveryRecord', deliveryRecordSchema);

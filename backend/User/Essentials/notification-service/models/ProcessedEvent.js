const mongoose = require('mongoose');

// Tracks Kafka events we've already processed — prevents duplicate notifications
const processedEventSchema = new mongoose.Schema({
  eventId:     { type: String, required: true, unique: true },
  processedAt: { type: Date, default: Date.now, expires: '7d' } // auto-cleanup after 7 days
});

module.exports = mongoose.model('ProcessedEvent', processedEventSchema);

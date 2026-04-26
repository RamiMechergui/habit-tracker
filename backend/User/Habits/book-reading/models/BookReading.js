const mongoose = require('mongoose');

const bookReadingSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  name: { type: String, default: '' },
  page: { type: String, default: '' },
  read: { type: Boolean, default: false }
}, { timestamps: true });

bookReadingSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('BookReading', bookReadingSchema);

const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  bookName: { type: String, default: '' },
  targetPages: { type: Number, default: 0 },
  startDate: { type: String, default: '' },
  isActive: { type: Boolean, default: false }
});

bookSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('Book', bookSchema);
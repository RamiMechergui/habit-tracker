const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  currentBook: {
    bookName: { type: String, default: '' },
    targetPages: { type: Number, default: 0 },
    startDate: { type: String, default: '' },
    isActive: { type: Boolean, default: false }
  },
  archivedBooks: [{
    bookName: { type: String },
    targetPages: { type: Number },
    startDate: { type: String },
    completionDate: { type: String },
    finalPage: { type: Number }]
});

bookSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('Book', bookSchema);
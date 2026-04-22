const mongoose = require('mongoose');

const currentBookSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  bookName: { type: String, default: '' },
  targetPages: { type: Number, default: 0 },
  startDate: { type: String, default: '' },
  isActive: { type: Boolean, default: false }
});

module.exports = mongoose.model('CurrentBook', currentBookSchema);
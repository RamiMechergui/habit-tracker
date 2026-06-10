const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['expense', 'income', 'habit'], default: 'expense' }
}, { timestamps: true });

categorySchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
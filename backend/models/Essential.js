const mongoose = require('mongoose');

const essentialSchema = new mongoose.Schema({
  userId:      { type: String, required: true, index: true },
  name:        { type: String, required: true, trim: true },
  icon:        { type: String, default: '🧴' },
  status:      { type: String, enum: ['A', 'BS', 'NA'], default: 'A' },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

essentialSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Essential', essentialSchema);
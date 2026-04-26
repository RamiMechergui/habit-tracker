const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

logSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Log', logSchema);
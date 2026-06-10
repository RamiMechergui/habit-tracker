const mongoose = require('mongoose');

const systemCheckSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  todo: { type: Boolean, default: false },
  money: { type: Boolean, default: false }
}, { timestamps: true });

systemCheckSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('SystemCheck', systemCheckSchema);
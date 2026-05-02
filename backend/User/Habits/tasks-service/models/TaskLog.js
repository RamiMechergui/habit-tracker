const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  time: { type: String, required: true },
  duration: { type: String, default: '30' },
  notificationEnabled: { type: Boolean, default: false },
  status: { type: String, enum: ['Pending', 'Completed', 'Missed'], default: 'Pending' },
  notificationSent: { type: Boolean, default: false }
});

const taskLogSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  tasks: [taskSchema]
}, { timestamps: true });

taskLogSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('TaskLog', taskLogSchema);

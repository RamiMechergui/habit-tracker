const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  expenses: [{
    desc: String,
    category: String,
    amount: { type: Number, default: 0 },
    time: String,
    cigarettesCount: { type: Number, default: 0 }
  }]
}, { timestamps: true });

expenseSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Expense', expenseSchema);
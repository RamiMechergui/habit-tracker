const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  expenseCategories: { 
    type: [String], 
    default: ['Food', 'Transportation', 'Entertainment']
  }
});

module.exports = mongoose.model('Category', categorySchema);
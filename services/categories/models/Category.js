const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  expenseCategories: { 
    type: [String], 
    default: ['Transportation', 'Food & Dining', 'Clothes', 'Tech & Electronics', 'Groceries', 'Entertainment', 'Health', 'Other']
  }
});

module.exports = mongoose.model('Category', categorySchema);
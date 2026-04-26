const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  profilePicture: { type: String, default: '' },
  expenseCategories: { 
    type: [String], 
    default: ['Food', 'Transportation', 'Entertainment']
  },
  theme: { type: String, default: 'dark' }
});

profileSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('Profile', profileSchema);
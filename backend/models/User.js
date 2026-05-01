const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicture: { type: String, default: '' },
  expenseCategories: { 
    type: [String], 
    default: ['Transportation', 'Food & Dining', 'Clothes', 'Tech & Electronics', 'Groceries', 'Entertainment', 'Health', 'Other']
  },
  currentBook: {
    bookName: { type: String, default: '' },
    targetPages: { type: Number, default: 0 },
    startDate: { type: String, default: '' },
    isActive: { type: Boolean, default: false }
  },
  archivedBooks: [{
    bookName: { type: String },
    targetPages: { type: Number },
    startDate: { type: String },
    completionDate: { type: String },
    finalPage: { type: Number }
  }],
  essentials: [{
    name:        { type: String, required: true },
    icon:        { type: String, default: '🧴' },
    status:      { type: String, enum: ['A', 'BS', 'NA'], default: 'A' },
    lastUpdated: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

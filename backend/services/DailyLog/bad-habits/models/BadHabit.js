const mongoose = require('mongoose');

const badHabitSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  smoking: { 
    checked: { type: Boolean, default: false },
    count: { type: Number, default: 0 }
  },
  sexual: { 
    checked: { type: Boolean, default: false }
  },
  social: { 
    checked: { type: Boolean, default: false },
    min: { type: Number, default: 0 }
  },
  phone: { 
    checked: { type: Boolean, default: false },
    min: { type: Number, default: 0 }
  },
  coffee: { 
    checked: { type: Boolean, default: false }
  },
  eating: { 
    checked: { type: Boolean, default: false }
  },
  noSugar: { 
    checked: { type: Boolean, default: false }
  }
}, { timestamps: true });

badHabitSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('BadHabit', badHabitSchema);

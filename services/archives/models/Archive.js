const mongoose = require('mongoose');

const archiveSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  archivedBooks: [{
    bookName: { type: String },
    targetPages: { type: Number },
    startDate: { type: String },
    completionDate: { type: String },
    finalPage: { type: Number }
  }]
});

module.exports = mongoose.model('Archive', archiveSchema);
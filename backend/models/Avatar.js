const mongoose = require('mongoose');

const avatarSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    profilePicture: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Avatar', avatarSchema);
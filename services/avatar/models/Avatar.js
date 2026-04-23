const mongoose = require('mongoose');

const avatarSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    // Stored as a base64 data-URL (e.g. "data:image/jpeg;base64,...")
    // MongoDB doc limit is 16 MB; cropped JPEGs are typically < 300 KB.
    profilePicture: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Avatar', avatarSchema);
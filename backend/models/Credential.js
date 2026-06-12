const mongoose = require('mongoose');

const credentialSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serviceName: { type: String, required: true },
  url: { type: String, default: '' },
  username: { type: String, required: true },
  password: { type: String, required: true }, // Store as encrypted string
  notes: { type: String, default: '' },
  category: { type: String, default: 'Other' },
  isPinned: { type: Boolean, default: false },
  tags: [{ type: String }]
}, { timestamps: true });

credentialSchema.index({ userId: 1 });

module.exports = mongoose.model('Credential', credentialSchema);

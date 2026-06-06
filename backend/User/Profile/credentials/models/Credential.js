const mongoose = require('mongoose');

const credentialSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  serviceName: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, required: true }, // Store as encrypted string
  notes: { type: String, default: '' },
  tags: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Credential', credentialSchema);

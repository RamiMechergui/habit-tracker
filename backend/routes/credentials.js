const express = require('express');
const router = express.Router();
const Credential = require('../models/Credential');
const { protect } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');

// Require authentication for all routes
router.use(protect);

// GET /api/credentials - Get all credentials for user (decrypted)
router.get('/', async (req, res) => {
  try {
    const credentials = await Credential.find({ userId: req.user._id }).sort({ serviceName: 1 }).lean();
    
    // Decrypt credentials
    const decryptedList = credentials.map(c => ({
      ...c,
      password: decrypt(c.password),
      notes: c.notes ? decrypt(c.notes) : ''
    }));
    
    res.json(decryptedList);
  } catch (err) {
    console.error('[Credentials] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch credentials' });
  }
});

// POST /api/credentials - Add new credential (encrypted)
router.post('/', async (req, res) => {
  try {
    const { serviceName, username, password, notes = '', tags = [] } = req.body;
    if (!serviceName || !username || !password) {
      return res.status(400).json({ message: 'ServiceName, username, and password are required' });
    }

    const encryptedPassword = encrypt(password);
    const encryptedNotes = notes ? encrypt(notes) : '';

    const cred = await Credential.create({
      userId: req.user._id,
      serviceName: serviceName.trim(),
      username: username.trim(),
      password: encryptedPassword,
      notes: encryptedNotes,
      tags
    });

    res.status(201).json({
      ...cred.toObject(),
      password,
      notes
    });
  } catch (err) {
    console.error('[Credentials] POST error:', err);
    res.status(500).json({ message: 'Failed to create credential' });
  }
});

// PUT /api/credentials/:id - Update credential (encrypted)
router.put('/:id', async (req, res) => {
  try {
    const { serviceName, username, password, notes, tags } = req.body;
    
    const updates = {};
    if (serviceName !== undefined) updates.serviceName = serviceName.trim();
    if (username !== undefined)    updates.username = username.trim();
    if (password !== undefined)    updates.password = encrypt(password);
    if (notes !== undefined)       updates.notes = notes ? encrypt(notes) : '';
    if (tags !== undefined)        updates.tags = tags;

    const cred = await Credential.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updates,
      { new: true }
    );

    if (!cred) return res.status(404).json({ message: 'Credential not found' });

    res.json({
      ...cred.toObject(),
      password: password !== undefined ? password : decrypt(cred.password),
      notes: notes !== undefined ? notes : (cred.notes ? decrypt(cred.notes) : '')
    });
  } catch (err) {
    console.error('[Credentials] PUT error:', err);
    res.status(500).json({ message: 'Failed to update credential' });
  }
});

// DELETE /api/credentials/:id - Delete credential
router.delete('/:id', async (req, res) => {
  try {
    const cred = await Credential.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!cred) return res.status(404).json({ message: 'Credential not found' });
    res.json({ message: 'Credential deleted successfully' });
  } catch (err) {
    console.error('[Credentials] DELETE error:', err);
    res.status(500).json({ message: 'Failed to delete credential' });
  }
});

module.exports = router;

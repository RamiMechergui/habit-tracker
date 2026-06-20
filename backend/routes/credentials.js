const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAllCredentials,
  createCredential,
  updateCredential,
  deleteCredential,
} = require('../db/credentials');
const { encrypt, decrypt } = require('../utils/crypto');

// Require authentication for all routes
router.use(protect);

// GET /api/credentials — all credentials for user (decrypted)
router.get('/', async (req, res) => {
  try {
    const credentials = await getAllCredentials(req.user.userId);
    const decryptedList = credentials.map(c => ({
      ...c,
      password: decrypt(c.password),
      notes:    c.notes ? decrypt(c.notes) : '',
    }));
    res.json(decryptedList);
  } catch (err) {
    console.error('[Credentials] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch credentials' });
  }
});

// POST /api/credentials — add new credential (encrypted)
router.post('/', async (req, res) => {
  try {
    const {
      serviceName, url = '', username, password,
      notes = '', category = 'Other', isPinned = false, tags = [],
    } = req.body;
    if (!serviceName || !username || !password) {
      return res.status(400).json({ message: 'ServiceName, username, and password are required' });
    }
    const cred = await createCredential(req.user.userId, {
      serviceName: serviceName.trim(),
      url:         url.trim(),
      username:    username.trim(),
      password:    encrypt(password),
      notes:       notes ? encrypt(notes) : '',
      category,
      isPinned,
      tags,
    });
    // Return the plaintext version to the caller
    res.status(201).json({ ...cred, password, notes });
  } catch (err) {
    console.error('[Credentials] POST error:', err);
    res.status(500).json({ message: 'Failed to create credential' });
  }
});

// PUT /api/credentials/:id — update credential (encrypted)
router.put('/:id', async (req, res) => {
  try {
    const { serviceName, url, username, password, notes, category, isPinned, tags } = req.body;
    const updates = {};
    if (serviceName !== undefined) updates.serviceName = serviceName.trim();
    if (url         !== undefined) updates.url         = url.trim();
    if (username    !== undefined) updates.username    = username.trim();
    if (password    !== undefined) updates.password    = encrypt(password);
    if (notes       !== undefined) updates.notes       = notes ? encrypt(notes) : '';
    if (category    !== undefined) updates.category    = category;
    if (isPinned    !== undefined) updates.isPinned    = isPinned;
    if (tags        !== undefined) updates.tags        = tags;

    const cred = await updateCredential(req.user.userId, req.params.id, updates);
    if (!cred) return res.status(404).json({ message: 'Credential not found' });

    res.json({
      ...cred,
      password: password !== undefined ? password : decrypt(cred.password),
      notes:    notes    !== undefined ? notes    : (cred.notes ? decrypt(cred.notes) : ''),
    });
  } catch (err) {
    console.error('[Credentials] PUT error:', err);
    res.status(500).json({ message: 'Failed to update credential' });
  }
});

// DELETE /api/credentials/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteCredential(req.user.userId, req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Credential not found' });
    res.json({ message: 'Credential deleted successfully' });
  } catch (err) {
    console.error('[Credentials] DELETE error:', err);
    res.status(500).json({ message: 'Failed to delete credential' });
  }
});

module.exports = router;

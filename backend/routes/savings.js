const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getAll, createEntry, updateEntry, deleteEntry } = require('../db/savings');
const { getAllCredentials, createCredential, updateCredential } = require('../db/credentials');
const { encrypt, decrypt } = require('../utils/crypto');

router.use(protect);

const VAULT_SERVICE_NAME = 'Saving Vault';

async function getVaultPassword(userId) {
  const creds = await getAllCredentials(userId);
  const vault = creds.find(c => c.serviceName === VAULT_SERVICE_NAME);
  if (!vault) return null;
  return { ...vault, password: decrypt(vault.password) };
}

async function upsertVaultCredential(userId, plainPassword) {
  const creds = await getAllCredentials(userId);
  const existing = creds.find(c => c.serviceName === VAULT_SERVICE_NAME);
  if (existing) {
    return await updateCredential(userId, existing.credentialId, {
      password: encrypt(plainPassword),
      serviceName: VAULT_SERVICE_NAME,
      username: 'vault',
      category: 'Finance',
    });
  }
  return await createCredential(userId, {
    serviceName: VAULT_SERVICE_NAME,
    username: 'vault',
    password: encrypt(plainPassword),
    category: 'Finance',
    notes: 'Saving Vault password',
  });
}

router.get('/', async (req, res) => {
  try {
    const entries = await getAll(req.user.userId);
    res.json(entries);
  } catch (err) {
    console.error('[Savings] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch savings entries' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { date, amount, type, note } = req.body;
    if (!date || amount === undefined || amount === null) {
      return res.status(400).json({ message: 'Date and amount are required' });
    }
    const entry = await createEntry(req.user.userId, { date, amount: Number(amount), type: type || 'deposit', note });
    res.status(201).json(entry);
  } catch (err) {
    console.error('[Savings] POST error:', err);
    res.status(500).json({ message: err.message || 'Failed to create savings entry' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { date, amount, type, note } = req.body;
    const updates = {};
    if (date !== undefined) updates.date = date;
    if (amount !== undefined) updates.amount = Number(amount);
    if (type !== undefined) updates.type = type;
    if (note !== undefined) updates.note = note;
    const entry = await updateEntry(req.user.userId, req.params.id, updates);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json(entry);
  } catch (err) {
    console.error('[Savings] PUT error:', err);
    res.status(500).json({ message: err.message || 'Failed to update entry' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteEntry(req.user.userId, req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Entry not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[Savings] DELETE error:', err);
    res.status(500).json({ message: 'Failed to delete entry' });
  }
});

router.post('/password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 4) {
      return res.status(400).json({ message: 'Password must be at least 4 characters' });
    }
    await upsertVaultCredential(req.user.userId, password);
    res.json({ success: true });
  } catch (err) {
    console.error('[Savings] Set password error:', err);
    res.status(500).json({ message: 'Failed to set vault password' });
  }
});

router.post('/verify-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }
    const vault = await getVaultPassword(req.user.userId);
    if (!vault || !vault.password) {
      return res.status(400).json({ message: 'No vault password set. Please set one first.' });
    }
    if (password !== vault.password) {
      return res.status(401).json({ message: 'Incorrect vault password' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Savings] Verify password error:', err);
    res.status(500).json({ message: 'Failed to verify password' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const vault = await getVaultPassword(req.user.userId);
    res.json({ hasPassword: !!vault && !!vault.password });
  } catch (err) {
    console.error('[Savings] Status error:', err);
    res.status(500).json({ message: 'Failed to check vault status' });
  }
});

module.exports = router;

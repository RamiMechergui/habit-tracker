const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const auth = require('./middleware/auth');
const Credential = require('./models/Credential');

const app = express();
app.use(express.json());
app.use(cookieParser());

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Connect to MongoDB
const mongoURI = process.env.MONGO_URI || 'mongodb://mongo:27017/credentials_db';
mongoose.connect(mongoURI)
  .then(() => console.log('Credentials Service: Connected to MongoDB'))
  .catch(err => console.error('Credentials Service: MongoDB connection error:', err));

// ── AES-256-CBC Encryption Helpers ──────────────────────────────────────────
const ALGORITHM = 'aes-256-cbc';

const getEncryptionKey = () => {
  const secret = process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_prod';
  return crypto.createHash('sha256').update(secret).digest();
};

const encrypt = (text) => {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

const decrypt = (hash) => {
  if (!hash || !hash.includes(':')) return '';
  try {
    const parts = hash.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return '[Decryption Error]';
  }
};

// ── API Routes ───────────────────────────────────────────────────────────────

// Get all credentials for the authenticated user
app.get('/api/credentials', auth, async (req, res) => {
  try {
    const credentials = await Credential.find({ userId: req.user.id }).sort({ createdAt: -1 });
    
    // Decrypt passwords before sending to the client
    const decryptedList = credentials.map(c => {
      const doc = c.toObject();
      doc.password = decrypt(doc.password);
      return doc;
    });

    res.json(decryptedList);
  } catch (error) {
    console.error('[GET /api/credentials] Error:', error.message);
    res.status(500).json({ message: 'Server error fetching credentials' });
  }
});

// Add a new credential
app.post('/api/credentials', auth, async (req, res) => {
  try {
    const { serviceName, username, password, notes = '', tags = [] } = req.body;
    if (!serviceName || !username || !password) {
      return res.status(400).json({ message: 'ServiceName, username, and password are required' });
    }

    const encryptedPassword = encrypt(password);

    const credential = new Credential({
      userId: req.user.id,
      serviceName,
      username,
      password: encryptedPassword,
      notes,
      tags
    });

    await credential.save();
    
    // Send decrypted copy back
    const responseDoc = credential.toObject();
    responseDoc.password = password;

    res.status(201).json(responseDoc);
  } catch (error) {
    console.error('[POST /api/credentials] Error:', error.message);
    res.status(500).json({ message: 'Server error adding credential' });
  }
});

// Update a credential
app.put('/api/credentials/:id', auth, async (req, res) => {
  try {
    const { serviceName, username, password, notes, tags } = req.body;
    
    const updates = {};
    if (serviceName !== undefined) updates.serviceName = serviceName;
    if (username !== undefined)    updates.username = username;
    if (password !== undefined)    updates.password = encrypt(password);
    if (notes !== undefined)       updates.notes = notes;
    if (tags !== undefined)        updates.tags = tags;

    const credential = await Credential.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updates,
      { new: true }
    );

    if (!credential) return res.status(404).json({ message: 'Credential not found' });
    
    const responseDoc = credential.toObject();
    responseDoc.password = password || decrypt(credential.password);

    res.json(responseDoc);
  } catch (error) {
    console.error('[PUT /api/credentials/:id] Error:', error.message);
    res.status(500).json({ message: 'Server error updating credential' });
  }
});

// Delete a credential
app.delete('/api/credentials/:id', auth, async (req, res) => {
  try {
    const credential = await Credential.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!credential) return res.status(404).json({ message: 'Credential not found' });
    res.json({ message: 'Credential deleted successfully' });
  } catch (error) {
    console.error('[DELETE /api/credentials/:id] Error:', error.message);
    res.status(500).json({ message: 'Server error deleting credential' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'credentials-service' });
});

const PORT = process.env.PORT || 5133;
app.listen(PORT, () => {
  console.log(`Credentials Service running on port ${PORT}`);
});

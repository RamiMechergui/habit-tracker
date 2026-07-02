/**
 * routes/german.js
 * ─────────────────────────────────────────────────────────────────────────────
 * API routes for the German Learning System.
 *
 * All image uploads are delegated to the storage service (MinIO / S3).
 * No filesystem storage is used for new uploads.
 *
 * Mounted at: /api/german
 */

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const { protect } = require('../middleware/auth');
const storage = require('../services/storage');
const {
  getAllGermanRecords,
  addVocab,
  updateVocab,
  addGrammar,
  updateGrammar,
  addVerb,
  updateVerb,
  saveNote,
  getNoteByDate,
  deleteGermanRecord,
  addDialogue,
  updateDialogue,
  addMemo,
  updateMemo,
} = require('../db/german');
const { translateText } = require('../services/translate');

router.use(protect);

// ── Shared multer config (memory storage → buffer to MinIO) ──────────────────
// Files are received in memory, validated, then uploaded to the storage service.
// No files are written to disk.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only image files allowed (JPEG, PNG, WebP, GIF)'));
    }
    cb(null, true);
  },
});

// ── GET /api/german  → all records for user ───────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const records = await getAllGermanRecords(req.user.userId);
    res.json(records);
  } catch (err) {
    console.error('[German] GET all error:', err);
    res.status(500).json({ message: 'Failed to fetch German records' });
  }
});

// ── GET /api/german/note?date=YYYY-MM-DD ─────────────────────────────────────
router.get('/note', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'date is required' });
    const note = await getNoteByDate(req.user.userId, date);
    res.json(note || null);
  } catch (err) {
    console.error('[German] GET note error:', err);
    res.status(500).json({ message: 'Failed to fetch note' });
  }
});

// ── POST /api/german/vocab ────────────────────────────────────────────────────
router.post('/vocab', async (req, res) => {
  try {
    const { word, translation, example, notes, category, plural, leitnerBox, lastReviewDate, mastery, favorite } = req.body;
    if (!word?.trim() || !translation?.trim()) {
      return res.status(400).json({ message: 'word and translation are required' });
    }
    const record = await addVocab(req.user.userId, { word: word.trim(), translation: translation.trim(), example, notes, category, plural, leitnerBox, lastReviewDate, mastery, favorite });
    res.status(201).json(record);
  } catch (err) {
    console.error('[German] POST vocab error:', err);
    res.status(500).json({ message: 'Failed to add vocabulary' });
  }
});

// ── PUT /api/german/vocab/:recordId ──────────────────────────────────────────
router.put('/vocab/:recordId', async (req, res) => {
  try {
    const updated = await updateVocab(req.user.userId, req.params.recordId, req.body);
    if (!updated) return res.status(404).json({ message: 'Record not found' });
    res.json(updated);
  } catch (err) {
    console.error('[German] PUT vocab error:', err);
    res.status(500).json({ message: 'Failed to update vocabulary' });
  }
});

// ── POST /api/german/vocab/:recordId/photo ─────────────────────────────────
// Uploads (or replaces) a vocab photo in MinIO/S3.
// If the record already has a MinIO-stored photo, the old object is deleted.
router.post('/vocab/:recordId/photo', (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload error' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    next();
  });
}, async (req, res) => {
  try {
    const { userId } = req.user;
    const { recordId } = req.params;
    const { buffer, mimetype, originalname } = req.file;
    const ext = path.extname(originalname) || '.jpg';

    // Fetch existing record to delete old photo if it exists
    const records = await getAllGermanRecords(userId);
    const record = records.find(r => r.recordId === recordId);
    if (record?.photoUrl?.startsWith('/api/german/images/')) {
      const oldKey = decodeURIComponent(record.photoUrl.slice('/api/german/images/'.length));
      await storage.deleteImage(oldKey);
    }

    const objectKey = `german/vocab/${userId}/${recordId.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;
    const result = await storage.uploadImage(objectKey, buffer, mimetype);

    const updated = await updateVocab(userId, recordId, { photoUrl: result.url });
    if (!updated) return res.status(404).json({ message: 'Record not found' });
    res.json({ photoUrl: result.url, record: updated });
  } catch (err) {
    console.error('[German] POST vocab photo error:', err);
    res.status(500).json({ message: 'Failed to upload photo' });
  }
});

// ── DELETE /api/german/vocab/:recordId/photo ────────────────────────────────
// Removes a vocab photo from MinIO/S3 and clears the DB field.
router.delete('/vocab/:recordId/photo', async (req, res) => {
  try {
    const records = await getAllGermanRecords(req.user.userId);
    const record = records.find(r => r.recordId === req.params.recordId);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (record.photoUrl) {
      // Extract object key from the stored URL: /api/german/images/{encodedKey}
      const keyPrefix = '/api/german/images/';
      if (record.photoUrl.startsWith(keyPrefix)) {
        const objectKey = decodeURIComponent(record.photoUrl.slice(keyPrefix.length));
        await storage.deleteImage(objectKey);
      }
    }
    await updateVocab(req.user.userId, req.params.recordId, { photoUrl: '' });
    res.json({ message: 'Photo removed' });
  } catch (err) {
    console.error('[German] DELETE vocab photo error:', err);
    res.status(500).json({ message: 'Failed to remove photo' });
  }
});

// ── POST /api/german/dialogue/:recordId/photo/:participantIndex ─────────────
// Uploads (or replaces) a dialogue participant photo in MinIO/S3.
// If the participant already has a MinIO-stored photo, the old object is
// deleted before uploading the new one. Data-URI presets are not stored.
router.post('/dialogue/:recordId/photo/:participantIndex', (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload error' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    next();
  });
}, async (req, res) => {
  try {
    const { userId } = req.user;
    const { recordId, participantIndex } = req.params;
    const { buffer, mimetype, originalname } = req.file;
    const ext = path.extname(originalname) || '.jpg';
    const pIdx = parseInt(participantIndex, 10);

    // Fetch existing record to check for old photo
    const records = await getAllGermanRecords(userId);
    const record = records.find(r => r.recordId === recordId && r.type === 'dialogue');
    if (!record) return res.status(404).json({ message: 'Dialogue not found' });
    const participants = [...(record.participants || [])];
    if (!participants[pIdx]) return res.status(400).json({ message: 'Invalid participant index' });

    // Delete old MinIO object if it exists (skip data-URI presets)
    const oldUrl = participants[pIdx].photoUrl || '';
    const keyPrefix = '/api/german/images/';
    if (oldUrl.startsWith(keyPrefix)) {
      const oldKey = decodeURIComponent(oldUrl.slice(keyPrefix.length));
      await storage.deleteImage(oldKey);
    }

    const objectKey = `german/dialogue/${userId}/${recordId.replace(/[^a-zA-Z0-9_-]/g, '_')}/p${pIdx}${ext}`;
    const result = await storage.uploadImage(objectKey, buffer, mimetype);

    participants[pIdx] = { ...participants[pIdx], photoUrl: result.url };
    const updated = await updateDialogue(userId, recordId, { participants });
    if (!updated) return res.status(404).json({ message: 'Failed to update dialogue' });
    res.json({ photoUrl: result.url, record: updated });
  } catch (err) {
    console.error('[German] POST dialogue photo error:', err);
    res.status(500).json({ message: 'Failed to upload participant photo' });
  }
});

// ── DELETE /api/german/dialogue/:recordId/photo/:participantIndex ───────────
// Removes a dialogue participant photo from MinIO/S3.
router.delete('/dialogue/:recordId/photo/:participantIndex', async (req, res) => {
  try {
    const { userId } = req.user;
    const { recordId, participantIndex } = req.params;
    const pIdx = parseInt(participantIndex, 10);
    const records = await getAllGermanRecords(userId);
    const record = records.find(r => r.recordId === recordId && r.type === 'dialogue');
    if (!record) return res.status(404).json({ message: 'Dialogue not found' });
    const participants = [...(record.participants || [])];
    if (!participants[pIdx]) return res.status(400).json({ message: 'Invalid participant index' });
    if (participants[pIdx].photoUrl) {
      const keyPrefix = '/api/german/images/';
      if (participants[pIdx].photoUrl.startsWith(keyPrefix)) {
        const objectKey = decodeURIComponent(participants[pIdx].photoUrl.slice(keyPrefix.length));
        await storage.deleteImage(objectKey);
      }
    }
    participants[pIdx] = { ...participants[pIdx], photoUrl: '' };
    const updated = await updateDialogue(userId, recordId, { participants });
    if (!updated) return res.status(404).json({ message: 'Failed to update dialogue' });
    res.json({ message: 'Photo removed', record: updated });
  } catch (err) {
    console.error('[German] DELETE dialogue photo error:', err);
    res.status(500).json({ message: 'Failed to remove participant photo' });
  }
});

// ── POST /api/german/note/photo ─────────────────────────────────────────────
// Uploads a note image to MinIO/S3. The returned URL is embedded in the
// note's HTML content by the rich text editor on the frontend.
router.post('/note/photo', (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload error' });
    if (!req.file) return res.status(400).json({ message: 'No file provided' });
    next();
  });
}, async (req, res) => {
  try {
    const { userId } = req.user;
    const { buffer, mimetype, originalname } = req.file;
    const ext = path.extname(originalname) || '.jpg';
    const objectKey = `german/note/${userId}/${Date.now()}${ext}`;

    const result = await storage.uploadImage(objectKey, buffer, mimetype);
    res.json({ url: result.url, filename: objectKey });
  } catch (err) {
    console.error('[German] POST note photo error:', err);
    res.status(500).json({ message: 'Failed to upload photo' });
  }
});

// ── POST /api/german/grammar ──────────────────────────────────────────────────
router.post('/grammar', async (req, res) => {
  try {
    const { rule, explanation, examples, category, level, mastery, favorite } = req.body;
    if (!rule?.trim() || !explanation?.trim()) {
      return res.status(400).json({ message: 'rule and explanation are required' });
    }
    const record = await addGrammar(req.user.userId, { rule: rule.trim(), explanation: explanation.trim(), examples, category, level, mastery, favorite });
    res.status(201).json(record);
  } catch (err) {
    console.error('[German] POST grammar error:', err);
    res.status(500).json({ message: 'Failed to add grammar rule' });
  }
});

// ── PUT /api/german/grammar/:recordId ────────────────────────────────────────
router.put('/grammar/:recordId', async (req, res) => {
  try {
    const updated = await updateGrammar(req.user.userId, req.params.recordId, req.body);
    if (!updated) return res.status(404).json({ message: 'Record not found' });
    res.json(updated);
  } catch (err) {
    console.error('[German] PUT grammar error:', err);
    res.status(500).json({ message: 'Failed to update grammar rule' });
  }
});

// ── POST /api/german/translate ───────────────────────────────────────────────
router.post('/translate', async (req, res) => {
  try {
    const { text, source, target } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'text is required' });
    const translated = await translateText(text, source || 'auto', target || 'de');
    res.json({ translatedText: translated });
  } catch (err) {
    console.error('[German] Translate error:', err);
    res.status(500).json({ message: 'Translation failed' });
  }
});

// ── POST /api/german/dialogue ─────────────────────────────────────────────
router.post('/dialogue', async (req, res) => {
  try {
    const { title, level, participants, exchanges } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: 'title is required' });
    if (!participants?.length || participants.length < 2) return res.status(400).json({ message: 'At least 2 participants required' });
    const record = await addDialogue(req.user.userId, { title: title.trim(), level: level || 'A2', participants, exchanges: exchanges || [] });
    res.status(201).json(record);
  } catch (err) {
    console.error('[German] POST dialogue error:', err);
    res.status(500).json({ message: 'Failed to create dialogue' });
  }
});

// ── PUT /api/german/dialogue/:recordId ────────────────────────────────────
router.put('/dialogue/:recordId', async (req, res) => {
  try {
    const updated = await updateDialogue(req.user.userId, req.params.recordId, req.body);
    if (!updated) return res.status(404).json({ message: 'Dialogue not found' });
    res.json(updated);
  } catch (err) {
    console.error('[German] PUT dialogue error:', err);
    res.status(500).json({ message: 'Failed to update dialogue' });
  }
});

// ── POST /api/german/memo ──────────────────────────────────────────────────────
router.post('/memo', async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ message: 'title and content are required' });
    }
    const record = await addMemo(req.user.userId, { title: title.trim(), content: content.trim() });
    res.status(201).json(record);
  } catch (err) {
    console.error('[German] POST memo error:', err);
    res.status(500).json({ message: 'Failed to add memorization paragraph' });
  }
});

// ── PUT /api/german/memo/:recordId ──────────────────────────────────────────
router.put('/memo/:recordId', async (req, res) => {
  try {
    const updated = await updateMemo(req.user.userId, req.params.recordId, req.body);
    if (!updated) return res.status(404).json({ message: 'Record not found' });
    res.json(updated);
  } catch (err) {
    console.error('[German] PUT memo error:', err);
    res.status(500).json({ message: 'Failed to update memorization paragraph' });
  }
});

// ── POST /api/german/verb ──────────────────────────────────────────────────────
router.post('/verb', async (req, res) => {
  try {
    const { infinitive, meaning, ich, du, erSieEs, wir, ihr, Sie, category, favorite } = req.body;
    if (!infinitive?.trim() || !meaning?.trim()) {
      return res.status(400).json({ message: 'infinitive and meaning are required' });
    }
    const record = await addVerb(req.user.userId, { infinitive: infinitive.trim(), meaning: meaning.trim(), ich, du, erSieEs, wir, ihr, Sie, category, favorite });
    res.status(201).json(record);
  } catch (err) {
    console.error('[German] POST verb error:', err);
    res.status(500).json({ message: 'Failed to add verb' });
  }
});

// ── PUT /api/german/verb/:recordId ────────────────────────────────────────────
router.put('/verb/:recordId', async (req, res) => {
  try {
    const updated = await updateVerb(req.user.userId, req.params.recordId, req.body);
    if (!updated) return res.status(404).json({ message: 'Record not found' });
    res.json(updated);
  } catch (err) {
    console.error('[German] PUT verb error:', err);
    res.status(500).json({ message: 'Failed to update verb' });
  }
});

// ── POST /api/german/note ─────────────────────────────────────────────────────
router.post('/note', async (req, res) => {
  try {
    const { date, content, studyMinutes, wordsLearned } = req.body;
    if (!date || !content?.trim()) {
      return res.status(400).json({ message: 'date and content are required' });
    }
    const record = await saveNote(req.user.userId, date, { content: content.trim(), studyMinutes, wordsLearned });
    res.json(record);
  } catch (err) {
    console.error('[German] POST note error:', err);
    res.status(500).json({ message: 'Failed to save note' });
  }
});

// ── DELETE /api/german/:recordId ──────────────────────────────────────────────
// Deletes a record and its associated image from MinIO/S3.
router.delete('/:recordId', async (req, res) => {
  try {
    const encodedId = req.params.recordId;
    const recordId = decodeURIComponent(encodedId);
    const records = await getAllGermanRecords(req.user.userId);
    const record = records.find(r => r.recordId === recordId);
    if (record) {
      // Clean up associated photo from MinIO/S3
      if (record.photoUrl) {
        const keyPrefix = '/api/german/images/';
        if (record.photoUrl.startsWith(keyPrefix)) {
          const objectKey = decodeURIComponent(record.photoUrl.slice(keyPrefix.length));
          await storage.deleteImage(objectKey);
        }
      }
      // Clean up dialogue participant photos
      if (record.type === 'dialogue' && record.participants) {
        for (const p of record.participants) {
          if (p.photoUrl && p.photoUrl.startsWith('/api/german/images/')) {
            const objectKey = decodeURIComponent(p.photoUrl.slice('/api/german/images/'.length));
            await storage.deleteImage(objectKey);
          }
        }
      }
    }
    await deleteGermanRecord(req.user.userId, recordId);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[German] DELETE error:', err);
    res.status(500).json({ message: 'Failed to delete record' });
  }
});

module.exports = router;

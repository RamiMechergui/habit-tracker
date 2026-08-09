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
  backfillLevels,
  addVocab,
  updateVocab,
  addGrammar,
  updateGrammar,
  addVerb,
  updateVerb,
  saveNote,
  getNoteByDate,
  getNotesByDate,
  deleteGermanRecord,
  addDialogue,
  updateDialogue,
  addMemo,
  updateMemo,
  addDocument,
  updateDocument,
  addExpression,
  updateExpression,
  addIdiom,
  updateIdiom,
  addMistake,
  updateMistake,
  addAlphabet,
  updateAlphabet,
  saveAlphabetNote,
  addResource,
  updateResource,
  addBook,
  updateBook,
  addChapter,
  updateChapter,
  getOrInitStudy,
  addStudyMs,
  resetStudyTotal,
  resetStudyDay,
} = require('../db/german');
const { translateText } = require('../services/translate');
const { getOrInitProgress } = require('../db/germanProgress');

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

// ── YouTube resource metadata helpers ─────────────────────────────────────────
function parseYouTubeUrl(url) {
  if (!url) return null;
  let m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([\w-]{11})/i) || url.match(/youtu\.be\/([\w-]{11})/i);
  if (m) return { kind: 'video', videoId: m[1] };
  m = url.match(/youtube\.com\/channel\/(UC[\w-]+)/i);
  if (m) return { kind: 'channel', channelId: m[1], handle: '' };
  m = url.match(/youtube\.com\/@([\w.\-]+)/i) || url.match(/youtube\.com\/user\/([\w.\-]+)/i);
  if (m) return { kind: 'channel', channelId: '', handle: m[1] };
  return null;
}

function decodeHtmlEntities(str) {
  return String(str)
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'");
}

async function fetchWithTimeout(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
  } finally {
    clearTimeout(t);
  }
}

async function fetchYouTubeResourceInfo(rawUrl) {
  const parsed = parseYouTubeUrl(rawUrl);
  if (!parsed) return { kind: 'link', url: rawUrl, title: rawUrl, author: '', thumbnail: '' };

  if (parsed.kind === 'video') {
    const base = { ...parsed, url: rawUrl, title: '', author: '', thumbnail: `https://img.youtube.com/vi/${parsed.videoId}/hqdefault.jpg` };
    try {
      const res = await fetchWithTimeout(`https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`);
      if (res.ok) {
        const j = await res.json();
        base.title = decodeHtmlEntities(j.title || '');
        base.author = decodeHtmlEntities(j.author_name || '');
        base.thumbnail = j.thumbnail_url || base.thumbnail;
      }
    } catch (_) { /* fall back to defaults */ }
    return base;
  }

  const base = { ...parsed, url: rawUrl, title: parsed.handle || parsed.channelId || '', author: '', thumbnail: '' };
  try {
    const pageUrl = parsed.channelId
      ? `https://www.youtube.com/channel/${parsed.channelId}?hl=en`
      : `https://www.youtube.com/@${parsed.handle}?hl=en`;
    const res = await fetchWithTimeout(pageUrl);
    if (res.ok) {
      const html = await res.text();
      const title = html.match(/<meta property="og:title" content="([^"]+)"/i);
      const image = html.match(/<meta property="og:image" content="([^"]+)"/i);
      if (title) base.title = decodeHtmlEntities(title[1]);
      if (image) base.thumbnail = image[1];
    }
  } catch (_) { /* fall back to defaults */ }
  return base;
}

// ── GET /api/german  → all records for user ───────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const records = await getAllGermanRecords(req.user.userId);
    const progress = await getOrInitProgress(req.user.userId);
    const currentLevel = progress?.currentLevel || 'A1.1';
    const backfilled = await backfillLevels(req.user.userId, currentLevel);
    if (backfilled > 0) {
      const refetched = await getAllGermanRecords(req.user.userId);
      return res.json(refetched);
    }
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
    const notes = await getNotesByDate(req.user.userId, date);
    res.json(notes);
  } catch (err) {
    console.error('[German] GET note error:', err);
    res.status(500).json({ message: 'Failed to fetch note' });
  }
});

// ── GET /api/german/study → accumulated study time ──────────────────────────
router.get('/study', async (req, res) => {
  try {
    const study = await getOrInitStudy(req.user.userId);
    res.json(study);
  } catch (err) {
    console.error('[German] GET study error:', err);
    res.status(500).json({ message: 'Failed to fetch study time' });
  }
});

// ── POST /api/german/study → add study time (ms) for a date ─────────────────
router.post('/study', async (req, res) => {
  try {
    const { date, ms } = req.body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'date (YYYY-MM-DD) is required' });
    }
    const amount = parseInt(ms);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'ms must be a positive number' });
    }
    const study = await addStudyMs(req.user.userId, date, amount);
    res.json(study);
  } catch (err) {
    console.error('[German] POST study error:', err);
    res.status(500).json({ message: 'Failed to save study time' });
  }
});

// ── DELETE /api/german/study → reset total study time to zero ────────────────
router.delete('/study', async (req, res) => {
  try {
    const study = await resetStudyTotal(req.user.userId);
    res.json(study);
  } catch (err) {
    console.error('[German] DELETE study error:', err);
    res.status(500).json({ message: 'Failed to reset study time' });
  }
});

// ── DELETE /api/german/study/day → reset study time for a specific date ──────
router.delete('/study/day', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'date (YYYY-MM-DD) query param is required' });
    }
    const study = await resetStudyDay(req.user.userId, date);
    res.json(study);
  } catch (err) {
    console.error('[German] DELETE study/day error:', err);
    res.status(500).json({ message: 'Failed to reset daily study time' });
  }
});

// ── POST /api/german/vocab ────────────────────────────────────────────────────
router.post('/vocab', async (req, res) => {
  try {
    const { word, translation, example, notes, category, plural, article, leitnerBox, lastReviewDate, mastery, favorite, boxes, level, chapterId, chapterTitle } = req.body;
    if (!word?.trim() || !translation?.trim()) {
      return res.status(400).json({ message: 'word and translation are required' });
    }
    const record = await addVocab(req.user.userId, { word: word.trim(), translation: translation.trim(), example, notes, category, plural, article, leitnerBox, lastReviewDate, mastery, favorite, boxes, level: level || 'A1.1', chapterId, chapterTitle });
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

// ── POST /api/german/vocab/:recordId/review ──────────────────────────────
router.post('/vocab/:recordId/review', async (req, res) => {
  try {
    const { score } = req.body; // 1=Again, 2=Hard, 3=Good, 4=Easy
    if (![1, 2, 3, 4].includes(score)) {
      return res.status(400).json({ message: 'Invalid score' });
    }

    const records = await getAllGermanRecords(req.user.userId);
    const current = records.find(r => r.recordId === req.params.recordId);
    if (!current) return res.status(404).json({ message: 'Record not found' });

    let easeFactor = current.easeFactor || 2.5;
    let interval = current.interval || 0;
    let lapses = current.lapses || 0;

    if (score < 3) {
      lapses += 1;
      interval = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    } else {
      if (interval === 0) interval = 1;
      else if (interval === 1) interval = 6;
      else interval = Math.round(interval * easeFactor);
      
      if (score === 4) easeFactor += 0.15;
    }

    const nextReviewDate = new Date(Date.now() + interval * 24 * 60 * 60 * 1000).toISOString();

    const updated = await updateVocab(req.user.userId, req.params.recordId, {
      easeFactor,
      interval,
      lapses,
      nextReviewDate,
      lastReviewDate: new Date().toISOString()
    });

    res.json(updated);
  } catch (err) {
    console.error('[German] POST vocab review error:', err);
    res.status(500).json({ message: 'Failed to process review' });
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
    const oldKey = storage.getKeyFromUrl(record?.photoUrl);
    if (oldKey !== null && oldKey !== '') {
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
      const objectKey = storage.getKeyFromUrl(record.photoUrl);
      if (objectKey !== null && objectKey !== '') {
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
    const oldKey = storage.getKeyFromUrl(participants[pIdx].photoUrl || '');
    if (oldKey !== null && oldKey !== '') {
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
      const objectKey = storage.getKeyFromUrl(participants[pIdx].photoUrl);
      if (objectKey !== null && objectKey !== '') {
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
    const { rule, explanation, examples, category, level, mastery, favorite, boxes, chapterId, chapterTitle } = req.body;
    if (!rule?.trim() || !explanation?.trim()) {
      return res.status(400).json({ message: 'rule and explanation are required' });
    }
    const record = await addGrammar(req.user.userId, { rule: rule.trim(), explanation: explanation.trim(), examples, category, level, mastery, favorite, boxes, chapterId, chapterTitle });
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
    const { title, level, participants, exchanges, boxes, chapterId, chapterTitle } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: 'title is required' });
    if (!participants?.length || participants.length < 2) return res.status(400).json({ message: 'At least 2 participants required' });
    const record = await addDialogue(req.user.userId, { title: title.trim(), level: level || 'A1.1', participants, exchanges: exchanges || [], boxes, chapterId, chapterTitle });
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
    const { title, content, germanContent, englishContent, memoFont, boxes, level, chapterId, chapterTitle } = req.body;
    if (!title?.trim() || !(content?.trim() || germanContent?.trim())) {
      return res.status(400).json({ message: 'title and content are required' });
    }
    const german = (germanContent ?? content ?? '').trim();
    const record = await addMemo(req.user.userId, {
      title: title.trim(),
      content: german,
      germanContent: german,
      englishContent: (englishContent ?? '').trim(),
      memoFont,
      boxes,
      level: level || 'A1.1',
      chapterId,
      chapterTitle,
    });
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

// ── POST /api/german/expression ──────────────────────────────────────────────
router.post('/expression', async (req, res) => {
  try {
    const { phrase, translation, category, favorite, boxes, level, chapterId, chapterTitle } = req.body;
    if (!phrase?.trim() || !translation?.trim()) {
      return res.status(400).json({ message: 'phrase and translation are required' });
    }
    const record = await addExpression(req.user.userId, { phrase: phrase.trim(), translation: translation.trim(), category, favorite, boxes, level: level || 'A1.1', chapterId, chapterTitle });
    res.status(201).json(record);
  } catch (err) {
    console.error('[German] POST expression error:', err);
    res.status(500).json({ message: 'Failed to add expression' });
  }
});

// ── PUT /api/german/expression/:recordId ─────────────────────────────────────
router.put('/expression/:recordId', async (req, res) => {
  try {
    const updated = await updateExpression(req.user.userId, req.params.recordId, req.body);
    if (!updated) return res.status(404).json({ message: 'Record not found' });
    res.json(updated);
  } catch (err) {
    console.error('[German] PUT expression error:', err);
    res.status(500).json({ message: 'Failed to update expression' });
  }
});

// ── POST /api/german/idiom ───────────────────────────────────────────────────
router.post('/idiom', async (req, res) => {
  try {
    const { phrase, translation, meaning, usage, category, favorite, level, chapterId, chapterTitle } = req.body;
    if (!phrase?.trim() || !translation?.trim()) {
      return res.status(400).json({ message: 'phrase and translation are required' });
    }
    const record = await addIdiom(req.user.userId, { phrase: phrase.trim(), translation: translation.trim(), meaning, usage, category, favorite, level: level || 'A1.1', chapterId, chapterTitle });
    res.status(201).json(record);
  } catch (err) {
    console.error('[German] POST idiom error:', err);
    res.status(500).json({ message: 'Failed to add idiom' });
  }
});

// ── PUT /api/german/idiom/:recordId ──────────────────────────────────────────
router.put('/idiom/:recordId', async (req, res) => {
  try {
    const updated = await updateIdiom(req.user.userId, req.params.recordId, req.body);
    if (!updated) return res.status(404).json({ message: 'Record not found' });
    res.json(updated);
  } catch (err) {
    console.error('[German] PUT idiom error:', err);
    res.status(500).json({ message: 'Failed to update idiom' });
  }
});

// ── POST /api/german/mistake ─────────────────────────────────────────────────
router.post('/mistake', async (req, res) => {
  try {
    const { incorrect, correct, why, category, favorite, level, chapterId, chapterTitle } = req.body;
    if (!incorrect?.trim() || !correct?.trim()) {
      return res.status(400).json({ message: 'incorrect and correct are required' });
    }
    const record = await addMistake(req.user.userId, { incorrect: incorrect.trim(), correct: correct.trim(), why, category, favorite, level: level || 'A1.1', chapterId, chapterTitle });
    res.status(201).json(record);
  } catch (err) {
    console.error('[German] POST mistake error:', err);
    res.status(500).json({ message: 'Failed to add mistake' });
  }
});

// ── PUT /api/german/mistake/:recordId ────────────────────────────────────────
router.put('/mistake/:recordId', async (req, res) => {
  try {
    const updated = await updateMistake(req.user.userId, req.params.recordId, req.body);
    if (!updated) return res.status(404).json({ message: 'Record not found' });
    res.json(updated);
  } catch (err) {
    console.error('[German] PUT mistake error:', err);
    res.status(500).json({ message: 'Failed to update mistake' });
  }
});

// ── POST /api/german/alphabet ────────────────────────────────────────────────
router.post('/alphabet', async (req, res) => {
  try {
    const { letter, example, english, pronunciation, photoUrl, note, level } = req.body;
    if (!letter?.trim() || !example?.trim()) {
      return res.status(400).json({ message: 'letter and example are required' });
    }
    const record = await addAlphabet(req.user.userId, { letter: letter.trim(), example: example.trim(), english, pronunciation, photoUrl, note, level: level || 'A1.1' });
    res.status(201).json(record);
  } catch (err) {
    console.error('[German] POST alphabet error:', err);
    res.status(500).json({ message: 'Failed to add alphabet' });
  }
});

// ── POST /api/german/alphabet-note ───────────────────────────────────────────
// Section-level note for the whole Alphabets section (single record).
router.post('/alphabet-note', async (req, res) => {
  try {
    const note = typeof req.body?.note === 'string' ? req.body.note : '';
    const record = await saveAlphabetNote(req.user.userId, note);
    res.json(record);
  } catch (err) {
    console.error('[German] POST alphabet-note error:', err);
    res.status(500).json({ message: 'Failed to save alphabet note' });
  }
});

// ── PUT /api/german/alphabet/:recordId ───────────────────────────────────────
router.put('/alphabet/:recordId', async (req, res) => {
  try {
    const updated = await updateAlphabet(req.user.userId, req.params.recordId, req.body);
    if (!updated) return res.status(404).json({ message: 'Record not found' });
    res.json(updated);
  } catch (err) {
    console.error('[German] PUT alphabet error:', err);
    res.status(500).json({ message: 'Failed to update alphabet' });
  }
});

// ── POST /api/german/alphabet/:recordId/photo ────────────────────────────────
router.post('/alphabet/:recordId/photo', (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const userId = req.user.userId;
    const { recordId } = req.params;
    const { buffer, mimetype } = req.file;
    const objectKey = `german/alphabet/${userId}/${recordId}_${Date.now()}`;
    const result = await storage.uploadImage(objectKey, buffer, mimetype);
    const updated = await updateAlphabet(userId, recordId, { photoUrl: result.url });
    res.json({ photoUrl: result.url, record: updated });
  } catch (err) {
    console.error('[German] POST alphabet photo error:', err);
    res.status(500).json({ message: 'Failed to upload photo' });
  }
});

// ── DELETE /api/german/alphabet/:recordId/photo ──────────────────────────────
router.delete('/alphabet/:recordId/photo', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { recordId } = req.params;
    const record = await updateAlphabet(userId, recordId, { photoUrl: '' });
    const objectKey = storage.getKeyFromUrl(record?.photoUrl);
    if (objectKey !== null && objectKey !== '') {
      await storage.deleteImage(objectKey);
    }
    res.json({ record });
  } catch (err) {
    console.error('[German] DELETE alphabet photo error:', err);
    res.status(500).json({ message: 'Failed to remove photo' });
  }
});

// ── POST /api/german/verb ──────────────────────────────────────────────────────
router.post('/verb', async (req, res) => {
  try {
    const { infinitive, meaning, ich, du, erSieEs, wir, ihr, Sie, category, favorite, boxes, level, chapterId, chapterTitle } = req.body;
    if (!infinitive?.trim() || !meaning?.trim()) {
      return res.status(400).json({ message: 'infinitive and meaning are required' });
    }
    const record = await addVerb(req.user.userId, { infinitive: infinitive.trim(), meaning: meaning.trim(), ich, du, erSieEs, wir, ihr, Sie, category, favorite, boxes, level: level || 'A1.1', chapterId, chapterTitle });
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
    const { date, content, noteId, title, boxes, noteCategory, studyMinutes, level, chapterId, chapterTitle, createdAt } = req.body;
    if (!date || !content?.trim()) {
      return res.status(400).json({ message: 'date and content are required' });
    }
    const record = await saveNote(req.user.userId, date, { noteId, title, content: content.trim(), boxes, noteCategory, studyMinutes, level: level || 'A1.1', chapterId, chapterTitle, createdAt });
    res.json(record);
  } catch (err) {
    console.error('[German] POST note error:', err);
    res.status(500).json({ message: 'Failed to save note' });
  }
});

// ── POST /api/german/book → add a book being studied ─────────────────────────
router.post('/book', async (req, res) => {
  try {
    const { name, author, notes, photoUrl, sortOrder, level, chapterId, chapterTitle } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'name is required' });
    const record = await addBook(req.user.userId, {
      name: name.trim(),
      author: author || '',
      notes: notes || '',
      photoUrl: photoUrl || '',
      sortOrder: sortOrder || Date.now(),
      level: level || 'A1.1',
      chapterId,
      chapterTitle,
    });
    res.status(201).json(record);
  } catch (err) {
    console.error('[German] POST book error:', err);
    res.status(500).json({ message: 'Failed to add book' });
  }
});

// ── POST /api/german/book/photo → upload a book cover photo ──────────────────
router.post('/book/photo', (req, res, next) => {
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
    const objectKey = `german/book/${userId}/${Date.now()}${ext}`;

    const result = await storage.uploadImage(objectKey, buffer, mimetype);
    res.json({ url: result.url, filename: objectKey });
  } catch (err) {
    console.error('[German] POST book photo error:', err);
    res.status(500).json({ message: 'Failed to upload photo' });
  }
});

// ── PUT /api/german/book/:recordId → update a book being studied ─────────────
router.put('/book/:recordId', async (req, res) => {
  try {
    const recordId = decodeURIComponent(req.params.recordId);
    const updated = await updateBook(req.user.userId, recordId, req.body);
    if (!updated) return res.status(404).json({ message: 'Book not found' });
    res.json(updated);
  } catch (err) {
    console.error('[German] PUT book error:', err);
    res.status(500).json({ message: 'Failed to update book' });
  }
});

// ── Resources (YouTube videos / channels) ─────────────────────────────────────

// GET /api/german/resource/info?url=… → metadata (kind, ids, title, author, thumbnail)
router.get('/resource/info', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ message: 'url is required' });
    const info = await fetchYouTubeResourceInfo(String(url));
    res.json(info);
  } catch (err) {
    console.error('[German] resource/info error:', err);
    res.status(500).json({ message: 'Failed to fetch resource info' });
  }
});

// POST /api/german/resource → add a learning resource
router.post('/resource', async (req, res) => {
  try {
    const { url, kind, videoId, channelId, handle, title, author, thumbnail, notes, sortOrder, level, chapterId, chapterTitle } = req.body;
    if (!url?.trim()) return res.status(400).json({ message: 'url is required' });
    const record = await addResource(req.user.userId, {
      url: url.trim(),
      kind: kind || 'video',
      videoId: videoId || '',
      channelId: channelId || '',
      handle: handle || '',
      title: title || '',
      author: author || '',
      thumbnail: thumbnail || '',
      notes: notes || '',
      sortOrder: sortOrder || Date.now(),
      level: level || 'A1.1',
      chapterId,
      chapterTitle,
    });
    res.json(record);
  } catch (err) {
    console.error('[German] POST resource error:', err);
    res.status(500).json({ message: 'Failed to add resource' });
  }
});

// PUT /api/german/resource/:recordId → update a learning resource
router.put('/resource/:recordId', async (req, res) => {
  try {
    const recordId = decodeURIComponent(req.params.recordId);
    const updated = await updateResource(req.user.userId, recordId, req.body);
    if (!updated) return res.status(404).json({ message: 'Resource not found' });
    res.json(updated);
  } catch (err) {
    console.error('[German] PUT resource error:', err);
    res.status(500).json({ message: 'Failed to update resource' });
  }
});

// ── POST /api/german/chapter → add a course chapter under a level ────────────
router.post('/chapter', async (req, res) => {
  try {
    const { title, level, sortOrder } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: 'title is required' });
    const record = await addChapter(req.user.userId, { title: title.trim(), level: level || 'A1.1', sortOrder });
    res.status(201).json(record);
  } catch (err) {
    console.error('[German] POST chapter error:', err);
    res.status(500).json({ message: 'Failed to add chapter' });
  }
});

// ── PUT /api/german/chapter/:recordId → update a chapter ─────────────────────
router.put('/chapter/:recordId', async (req, res) => {
  try {
    const recordId = decodeURIComponent(req.params.recordId);
    const updated = await updateChapter(req.user.userId, recordId, req.body);
    if (!updated) return res.status(404).json({ message: 'Chapter not found' });
    res.json(updated);
  } catch (err) {
    console.error('[German] PUT chapter error:', err);
    res.status(500).json({ message: 'Failed to update chapter' });
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
      const recordKey = storage.getKeyFromUrl(record.photoUrl);
      if (recordKey !== null && recordKey !== '') {
        await storage.deleteImage(recordKey);
      }
      // Clean up dialogue participant photos
      if (record.type === 'dialogue' && record.participants) {
        for (const p of record.participants) {
          const pKey = storage.getKeyFromUrl(p.photoUrl);
          if (pKey !== null && pKey !== '') {
            await storage.deleteImage(pKey);
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

// ── Documents ─────────────────────────────────────────────────────────────────

router.post('/documents', async (req, res) => {
  try {
    const created = await addDocument(req.user.id, req.body);
    res.status(201).json(created);
  } catch (err) {
    console.error('Add document error:', err);
    res.status(500).json({ message: 'Server error adding document' });
  }
});

router.put('/documents/:recordId', async (req, res) => {
  try {
    const updated = await updateDocument(req.user.id, req.params.recordId, req.body);
    if (!updated) return res.status(404).json({ message: 'Document not found' });
    res.json(updated);
  } catch (err) {
    console.error('Update document error:', err);
    res.status(500).json({ message: 'Server error updating document' });
  }
});

module.exports = router;

/**
 * routes/german.js
 * ─────────────────────────────────────────────────────────────────────────────
 * API routes for the German Learning System.
 *
 * Mounted at: /api/german
 */

const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
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
} = require('../db/german');

router.use(protect);

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
router.delete('/:recordId', async (req, res) => {
  try {
    const encodedId = req.params.recordId;
    // recordId may contain '#' which needs to be URL-decoded
    const recordId = decodeURIComponent(encodedId);
    await deleteGermanRecord(req.user.userId, recordId);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[German] DELETE error:', err);
    res.status(500).json({ message: 'Failed to delete record' });
  }
});

module.exports = router;

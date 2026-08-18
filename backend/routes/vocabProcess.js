/**
 * routes/vocabProcess.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/vocab/process  → LLM-structured vocabulary processing
 * POST /api/vocab/save     → Save a processed card to DynamoDB
 *
 * Mounted at: /api/vocab
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { processVocab } = require('../services/vocabProcessor');
const { addUnifiedVocab, updateUnifiedVocab, getAllGermanRecords } = require('../db/german');
const { EntryCategory, REQUEST_SCHEMA } = require('../types/vocabulary');

router.use(protect);

// ── POST /api/vocab/process ──────────────────────────────────────────────────
router.post('/process', async (req, res) => {
  try {
    const { rawInput, category, hints, targetLang, sourceLang, level } = req.body;

    if (!rawInput || !rawInput.trim()) {
      return res.status(400).json({ message: 'rawInput is required' });
    }

    const validCategories = Object.values(EntryCategory);
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      });
    }

    const result = await processVocab({
      rawInput: rawInput.trim(),
      category: category || EntryCategory.AUTO,
      hints: hints || {},
      targetLang: targetLang || 'de',
      sourceLang: sourceLang || 'en',
      level,
    });

    res.json(result);
  } catch (err) {
    console.error('[VocabProcess] Error:', err.message);

    if (err.message.includes('API key is not configured') || err.message.includes('GEMINI_API_KEY')) {
      return res.status(503).json({ message: err.message });
    }
    if (err.message.includes('LLM returned empty response') || err.message.includes('not valid JSON')) {
      return res.status(502).json({ message: 'LLM returned an unexpected response. Please try again.' });
    }
    if (err.message.includes('Validation failed')) {
      return res.status(422).json({ message: err.message });
    }

    res.status(500).json({ message: 'Failed to process vocabulary entry' });
  }
});

// ── POST /api/vocab/save ─────────────────────────────────────────────────────
router.post('/save', async (req, res) => {
  try {
    const { entryMetadata, linguisticData, uiConfig, level, chapterId, chapterTitle } = req.body;

    if (!entryMetadata?.word || !entryMetadata?.translation) {
      return res.status(400).json({ message: 'entryMetadata.word and entryMetadata.translation are required' });
    }

    const record = await addUnifiedVocab(req.user.userId, {
      entryMetadata,
      linguisticData: linguisticData || {},
      uiConfig,
      level,
      chapterId,
      chapterTitle,
    });

    res.status(201).json(record);
  } catch (err) {
    console.error('[VocabProcess] Save error:', err);
    res.status(500).json({ message: 'Failed to save vocabulary entry' });
  }
});

// ── PUT /api/vocab/save/:recordId ────────────────────────────────────────────
router.put('/save/:recordId', async (req, res) => {
  try {
    const recordId = decodeURIComponent(req.params.recordId);
    const updated = await updateUnifiedVocab(req.user.userId, recordId, req.body);
    if (!updated) return res.status(404).json({ message: 'Record not found' });
    res.json(updated);
  } catch (err) {
    console.error('[VocabProcess] Update error:', err);
    res.status(500).json({ message: 'Failed to update vocabulary entry' });
  }
});

module.exports = router;

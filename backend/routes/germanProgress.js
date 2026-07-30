const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getOrInitProgress, advanceLevel, setCurrentLevel, LEVELS,
} = require('../db/germanProgress');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const progress = await getOrInitProgress(req.user.userId);
    res.json(progress);
  } catch (err) {
    console.error('[Progress] GET error:', err);
    res.status(500).json({ message: 'Failed to get progress' });
  }
});

router.post('/advance', async (req, res) => {
  try {
    const newState = await advanceLevel(req.user.userId);
    if (!newState) return res.status(400).json({ message: 'Already at max level' });
    res.json(newState);
  } catch (err) {
    console.error('[Progress] POST advance error:', err);
    res.status(500).json({ message: 'Failed to advance' });
  }
});

router.put('/level', async (req, res) => {
  try {
    const { level } = req.body;
    if (!level || !LEVELS.includes(level)) {
      return res.status(400).json({ message: 'Invalid level' });
    }
    const state = await getOrInitProgress(req.user.userId);
    const idx = LEVELS.indexOf(level);
    const currentIdx = LEVELS.indexOf(state.currentLevel);
    if (idx > currentIdx + 1) {
      return res.status(400).json({ message: 'Cannot skip levels' });
    }
    const updated = await setCurrentLevel(req.user.userId, level);
    res.json(updated);
  } catch (err) {
    console.error('[Progress] PUT level error:', err);
    res.status(500).json({ message: 'Failed to set level' });
  }
});

router.get('/levels', (_req, res) => {
  res.json(LEVELS);
});

module.exports = router;

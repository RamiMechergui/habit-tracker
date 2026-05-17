const express = require('express');
const router  = express.Router();
const Note    = require('../models/Note');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// GET /api/notes          → all notes for this user, sorted newest first
// GET /api/notes?date=... → notes for a specific date
router.get('/', async (req, res) => {
  try {
    const query = { userId: req.user._id };
    if (req.query.date) query.date = req.query.date;

    const notes = await Note.find(query).sort({ createdAt: -1 }).lean();
    res.json(notes);
  } catch (err) {
    console.error('[Notes] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch notes' });
  }
});

// POST /api/notes
router.post('/', async (req, res) => {
  try {
    const { date, content } = req.body;
    if (!date || !content?.trim()) {
      return res.status(400).json({ message: 'date and content are required' });
    }
    const note = await Note.create({ userId: req.user._id, date, content: content.trim() });
    res.status(201).json(note);
  } catch (err) {
    console.error('[Notes] POST error:', err);
    res.status(500).json({ message: 'Failed to create note' });
  }
});

// PUT /api/notes/:id
router.put('/:id', async (req, res) => {
  try {
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { content: req.body.content?.trim() },
      { new: true }
    );
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json(note);
  } catch (err) {
    console.error('[Notes] PUT error:', err);
    res.status(500).json({ message: 'Failed to update note' });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[Notes] DELETE error:', err);
    res.status(500).json({ message: 'Failed to delete note' });
  }
});

module.exports = router;

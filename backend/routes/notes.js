const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAllNotes,
  getNotesByDate,
  createNote,
  updateNote,
  deleteNote,
} = require('../db/notes');

// All routes require authentication
router.use(protect);

// GET /api/notes
// GET /api/notes?date=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const notes = req.query.date
      ? await getNotesByDate(req.user.userId, req.query.date)
      : await getAllNotes(req.user.userId);
    res.json(notes);
  } catch (err) {
    console.error('[Notes] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch notes' });
  }
});

// POST /api/notes
router.post('/', async (req, res) => {
  try {
    const { date, content, section } = req.body;
    if (!date || !content?.trim()) {
      return res.status(400).json({ message: 'date and content are required' });
    }
    const note = await createNote(req.user.userId, date, content.trim(), section || '');
    res.status(201).json(note);
  } catch (err) {
    console.error('[Notes] POST error:', err);
    res.status(500).json({ message: 'Failed to create note' });
  }
});

// PUT /api/notes/:id
router.put('/:id', async (req, res) => {
  try {
    const { content, section } = req.body;
    const note = await updateNote(req.user.userId, req.params.id, content?.trim(), section);
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
    const deleted = await deleteNote(req.user.userId, req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Note not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[Notes] DELETE error:', err);
    res.status(500).json({ message: 'Failed to delete note' });
  }
});

module.exports = router;

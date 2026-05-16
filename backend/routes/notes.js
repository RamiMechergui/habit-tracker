const express = require('express');
const router = express.Router();
const DailyNote = require('../models/DailyNote');
const auth = require('../middleware/auth');

// Get notes for a specific date
router.get('/', auth, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Date parameter is required' });

    const notes = await DailyNote.find({ userId: req.user.id, date }).sort({ createdAt: 1 });
    res.json(notes);
  } catch (error) {
    console.error('[GET /api/notes] Error:', error);
    res.status(500).json({ message: 'Server error fetching notes' });
  }
});

// Add a new note
router.post('/', auth, async (req, res) => {
  try {
    const { date, content } = req.body;
    if (!date || !content) return res.status(400).json({ message: 'Date and content are required' });

    const note = new DailyNote({
      userId: req.user.id,
      date,
      content
    });

    await note.save();
    res.status(201).json(note);
  } catch (error) {
    console.error('[POST /api/notes] Error:', error);
    res.status(500).json({ message: 'Server error adding note' });
  }
});

// Update a note
router.put('/:id', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: 'Content is required' });

    const note = await DailyNote.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { content },
      { new: true }
    );

    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json(note);
  } catch (error) {
    console.error('[PUT /api/notes] Error:', error);
    res.status(500).json({ message: 'Server error updating note' });
  }
});

// Delete a note
router.delete('/:id', auth, async (req, res) => {
  try {
    const note = await DailyNote.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('[DELETE /api/notes] Error:', error);
    res.status(500).json({ message: 'Server error deleting note' });
  }
});

module.exports = router;

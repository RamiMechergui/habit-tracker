const express = require('express');
const multer  = require('multer');
const path    = require('path');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const storage = require('../services/storage');
const {
  getAllNotes,
  getNotesByDate,
  createNote,
  updateNote,
  deleteNote,
} = require('../db/notes');

const upload = multer({ storage: multer.memoryStorage() });

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
    const { date, content, section, image } = req.body;
    if (!date || !content?.trim()) {
      return res.status(400).json({ message: 'date and content are required' });
    }
    const note = await createNote(req.user.userId, date, content.trim(), section || '', image || '');
    res.status(201).json(note);
  } catch (err) {
    console.error('[Notes] POST error:', err);
    res.status(500).json({ message: 'Failed to create note' });
  }
});

// PUT /api/notes/:id
router.put('/:id', async (req, res) => {
  try {
    const { content, section, image } = req.body;
    const note = await updateNote(req.user.userId, req.params.id, content?.trim(), section, image);
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

// POST /api/notes/photo — upload a photo and return its URL
router.post('/photo', (req, res, next) => {
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
    const objectKey = `notes/${userId}/${Date.now()}${ext}`;

    const result = await storage.uploadImage(objectKey, buffer, mimetype);
    const imageUrl = `/api/notes/images/${encodeURIComponent(objectKey)}`;
    res.json({ url: imageUrl, filename: objectKey });
  } catch (err) {
    console.error('[Notes] POST photo error:', err);
    res.status(500).json({ message: 'Failed to upload photo' });
  }
});

module.exports = router;

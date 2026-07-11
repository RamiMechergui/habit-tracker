const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { protect }                 = require('../middleware/auth');
const { getUserById, updateUser } = require('../db/users');

// Multer setup for planned book photo uploads
const photoDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(photoDir)) fs.mkdirSync(photoDir, { recursive: true });

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, photoDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `planned_${req.user.userId}_${Date.now()}${ext}`);
  },
});

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error('Only image files allowed (JPEG, PNG, WebP, GIF)'));
    }
    cb(null, true);
  },
});

// GET /api/books/current
router.get('/current', protect, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);
    res.json(user.currentBook || {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/books/current — set a new current book (multipart for photo)
router.post('/current', protect, photoUpload.single('photo'), async (req, res) => {
  try {
    const { bookName, targetPages, author, photoUrl: existingPhotoUrl } = req.body;
    if (!bookName?.trim())          return res.status(400).json({ message: 'Book name required' });
    if (!targetPages || targetPages <= 0) return res.status(400).json({ message: 'Target pages > 0 required' });

    let photoUrl = existingPhotoUrl || '';
    if (req.file) {
      photoUrl = `/uploads/${req.file.filename}`;
    }

    const currentBook = {
      bookName:   bookName.trim(),
      author:     (author || '').trim(),
      targetPages: parseInt(targetPages),
      startDate:  new Date().toISOString().split('T')[0],
      isActive:   true,
      photoUrl,
    };
    const updated = await updateUser(req.user.userId, { currentBook });
    res.json(updated.currentBook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}, (err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File size exceeds 5 MB' });
  }
  if (err) return res.status(400).json({ message: err.message });
});

// PUT /api/books/current — update / archive / stop current book
router.put('/current', protect, async (req, res) => {
  try {
    const { isActive, finalPage, stopped } = req.body;
    const user = await getUserById(req.user.userId);
    if (!user.currentBook.bookName) return res.status(400).json({ message: 'No active book' });

    let { currentBook, archivedBooks } = user;

    if (isActive === false && currentBook.isActive === true) {
      const archivedBook = {
        bookName:       currentBook.bookName,
        author:         currentBook.author || '',
        targetPages:    currentBook.targetPages,
        startDate:      currentBook.startDate,
        completionDate: new Date().toISOString().split('T')[0],
        finalPage:      finalPage || 0,
        status:         stopped ? 'stopped' : 'completed',
        photoUrl:       currentBook.photoUrl || '',
      };
      archivedBooks = [...(archivedBooks || []), archivedBook];
      currentBook   = { bookName: '', targetPages: 0, startDate: '', isActive: false, photoUrl: '' };
    } else {
      currentBook = { ...currentBook, isActive: isActive !== undefined ? isActive : false };
    }

    const updated = await updateUser(req.user.userId, { currentBook, archivedBooks });
    res.json({ currentBook: updated.currentBook, archivedBooks: updated.archivedBooks || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/books/archived
router.get('/archived', protect, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);
    res.json({ archivedBooks: user.archivedBooks || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Planned Books ─────────────────────────────────────────────────

// GET /api/books/planned
router.get('/planned', protect, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);
    res.json({ plannedBooks: user.plannedBooks || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/books/planned/photo — upload a planned book photo standalone, returns URL
router.post('/planned/photo', protect, photoUpload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    res.json({ photoUrl: `/uploads/${req.file.filename}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}, (err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File size exceeds 5 MB' });
  }
  if (err) return res.status(400).json({ message: err.message });
});

// POST /api/books/planned — add a planned book
router.post('/planned', protect, async (req, res) => {
  try {
    const { bookName, author, photoUrl } = req.body;
    if (!bookName?.trim()) return res.status(400).json({ message: 'Book name is required' });

    const user = await getUserById(req.user.userId);
    const plannedBooks = [...(user.plannedBooks || []), {
      bookName: bookName.trim(),
      author: (author || '').trim(),
      addedAt: new Date().toISOString().split('T')[0],
      photoUrl: photoUrl || '',
    }];
    const updated = await updateUser(req.user.userId, { plannedBooks });
    res.status(201).json(updated.plannedBooks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/books/planned/:index/photo — upload photo for a planned book
router.post('/planned/:index/photo', protect, photoUpload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const idx = parseInt(req.params.index, 10);
    const user = await getUserById(req.user.userId);
    const plannedBooks = [...(user.plannedBooks || [])];
    if (idx < 0 || idx >= plannedBooks.length) {
      return res.status(404).json({ message: 'Book not found' });
    }
    plannedBooks[idx] = { ...plannedBooks[idx], photoUrl: `/uploads/${req.file.filename}` };
    const updated = await updateUser(req.user.userId, { plannedBooks });
    res.json(updated.plannedBooks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}, (err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File size exceeds 5 MB' });
  }
  if (err) return res.status(400).json({ message: err.message });
});

// DELETE /api/books/planned/:index — remove a planned book by index
router.delete('/planned/:index', protect, async (req, res) => {
  try {
    const idx = parseInt(req.params.index, 10);
    const user = await getUserById(req.user.userId);
    const plannedBooks = (user.plannedBooks || []).filter((_, i) => i !== idx);
    const updated = await updateUser(req.user.userId, { plannedBooks });
    res.json(updated.plannedBooks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/books/archived/:index — remove an archived book by index
router.delete('/archived/:index', protect, async (req, res) => {
  try {
    const idx = parseInt(req.params.index, 10);
    const user = await getUserById(req.user.userId);
    const archivedBooks = (user.archivedBooks || []).filter((_, i) => i !== idx);
    const updated = await updateUser(req.user.userId, { archivedBooks });
    res.json(updated.archivedBooks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
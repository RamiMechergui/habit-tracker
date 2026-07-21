const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { protect }                 = require('../middleware/auth');
const { getUserById, updateUser } = require('../db/users');
const plannedBooksDb              = require('../db/plannedBooks');
const archivedBooksDb             = require('../db/archivedBooks');

// Multer setup for book photo uploads
const photoDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(photoDir)) fs.mkdirSync(photoDir, { recursive: true });

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, photoDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `book_${req.user.userId}_${Date.now()}${ext}`);
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

function multerError(err, _req, res, _next) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File size exceeds 5 MB' });
  }
  if (err) return res.status(400).json({ message: err.message });
}

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
}, multerError);

// PUT /api/books/current — update / archive / stop current book
router.put('/current', protect, async (req, res) => {
  try {
    const { isActive, finalPage, stopped } = req.body;
    const user = await getUserById(req.user.userId);
    if (!user.currentBook.bookName) return res.status(400).json({ message: 'No active book' });

    let { currentBook } = user;

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
      await archivedBooksDb.createItem(req.user.userId, archivedBook);
      currentBook = { bookName: '', targetPages: 0, startDate: '', isActive: false, photoUrl: '' };
    } else {
      currentBook = { ...currentBook, isActive: isActive !== undefined ? isActive : false };
    }

    await updateUser(req.user.userId, { currentBook });

    const archivedBooks = await archivedBooksDb.getAll(req.user.userId);
    res.json({ currentBook, archivedBooks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/books/archived
router.get('/archived', protect, async (req, res) => {
  try {
    const archivedBooks = await archivedBooksDb.getAll(req.user.userId);
    res.json({ archivedBooks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Planned Books ─────────────────────────────────────────────────

// GET /api/books/planned
router.get('/planned', protect, async (req, res) => {
  try {
    const plannedBooks = await plannedBooksDb.getAll(req.user.userId);
    res.json({ plannedBooks });
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
}, multerError);

// POST /api/books/planned — add a planned book
router.post('/planned', protect, async (req, res) => {
  try {
    const { bookName, author, photoUrl } = req.body;
    if (!bookName?.trim()) return res.status(400).json({ message: 'Book name is required' });

    await plannedBooksDb.createItem(req.user.userId, {
      bookName: bookName.trim(),
      author: (author || '').trim(),
      photoUrl: photoUrl || '',
    });

    const plannedBooks = await plannedBooksDb.getAll(req.user.userId);
    res.status(201).json(plannedBooks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/books/planned/:bookId/photo — upload photo for a planned book
router.post('/planned/:bookId/photo', protect, photoUpload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    await plannedBooksDb.updatePhoto(req.user.userId, req.params.bookId, `/uploads/${req.file.filename}`);
    const plannedBooks = await plannedBooksDb.getAll(req.user.userId);
    res.json(plannedBooks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}, multerError);

// PUT /api/books/planned/:bookId — edit a planned book
router.put('/planned/:bookId', protect, async (req, res) => {
  try {
    const { bookName, author } = req.body;
    if (!bookName?.trim()) return res.status(400).json({ message: 'Book name is required' });

    await plannedBooksDb.updateItem(req.user.userId, req.params.bookId, {
      bookName: bookName.trim(),
      author: (author || '').trim(),
    });

    const plannedBooks = await plannedBooksDb.getAll(req.user.userId);
    res.json(plannedBooks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/books/planned/:bookId — remove a planned book
router.delete('/planned/:bookId', protect, async (req, res) => {
  try {
    await plannedBooksDb.deleteItem(req.user.userId, req.params.bookId);
    const plannedBooks = await plannedBooksDb.getAll(req.user.userId);
    res.json(plannedBooks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/books/archived/:bookId — remove an archived book
router.delete('/archived/:bookId', protect, async (req, res) => {
  try {
    await archivedBooksDb.deleteItem(req.user.userId, req.params.bookId);
    const archivedBooks = await archivedBooksDb.getAll(req.user.userId);
    res.json(archivedBooks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

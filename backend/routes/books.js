const express = require('express');
const router  = express.Router();
const { protect }               = require('../middleware/auth');
const { getUserById, updateUser } = require('../db/users');

// GET /api/books/current
router.get('/current', protect, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);
    res.json(user.currentBook || {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/books/current — set a new current book
router.post('/current', protect, async (req, res) => {
  try {
    const { bookName, targetPages } = req.body;
    if (!bookName?.trim())          return res.status(400).json({ message: 'Book name required' });
    if (!targetPages || targetPages <= 0) return res.status(400).json({ message: 'Target pages > 0 required' });

    const currentBook = {
      bookName:   bookName.trim(),
      targetPages: parseInt(targetPages),
      startDate:  new Date().toISOString().split('T')[0],
      isActive:   true,
    };
    const updated = await updateUser(req.user.userId, { currentBook });
    res.json(updated.currentBook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/books/current — update / archive current book
router.put('/current', protect, async (req, res) => {
  try {
    const { isActive, finalPage } = req.body;
    const user = await getUserById(req.user.userId);
    if (!user.currentBook.bookName) return res.status(400).json({ message: 'No active book' });

    let { currentBook, archivedBooks } = user;

    if (isActive === false && currentBook.isActive === true) {
      const archivedBook = {
        bookName:       currentBook.bookName,
        targetPages:    currentBook.targetPages,
        startDate:      currentBook.startDate,
        completionDate: new Date().toISOString().split('T')[0],
        finalPage:      finalPage || currentBook.targetPages,
      };
      archivedBooks = [...(archivedBooks || []), archivedBook];
      currentBook   = { bookName: '', targetPages: 0, startDate: '', isActive: false };
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

module.exports = router;
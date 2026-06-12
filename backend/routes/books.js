const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
// GET current book
router.get('/current', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('currentBook');
    res.json(user.currentBook || {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST set current book
router.post('/current', protect, async (req, res) => {
  try {
    const { bookName, targetPages } = req.body;
    if (!bookName?.trim()) return res.status(400).json({ message: 'Book name required' });
    if (!targetPages || targetPages <= 0) return res.status(400).json({ message: 'Target pages > 0 required' });

    const user = await User.findById(req.user._id);
    user.currentBook = {
      bookName: bookName.trim(),
      targetPages: parseInt(targetPages),
      startDate: new Date().toISOString().split('T')[0],
      isActive: true
    };
    await user.save();
    res.json(user.currentBook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update current book (complete/archive)
router.put('/current', protect, async (req, res) => {
  try {
    const { isActive, finalPage } = req.body;
    const user = await User.findById(req.user._id);
    if (!user.currentBook.bookName) return res.status(400).json({ message: 'No active book' });

    if (isActive === false && user.currentBook.isActive === true) {
      const archivedBook = {
        bookName: user.currentBook.bookName,
        targetPages: user.currentBook.targetPages,
        startDate: user.currentBook.startDate,
        completionDate: new Date().toISOString().split('T')[0],
        finalPage: finalPage || user.currentBook.targetPages
      };

      if (!user.archivedBooks) user.archivedBooks = [];
      user.archivedBooks.push(archivedBook);
      user.currentBook = { bookName: '', targetPages: 0, startDate: '', isActive: false };
    } else {
      user.currentBook.isActive = isActive !== undefined ? isActive : false;
    }

    await user.save();
    res.json({ currentBook: user.currentBook, archivedBooks: user.archivedBooks || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET archived books
router.get('/archived', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('archivedBooks');
    res.json({ archivedBooks: user.archivedBooks || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
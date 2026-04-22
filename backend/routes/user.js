const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer — store to disk with original extension, no size limit
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user_${req.user._id}${ext}`);
  }
});

const upload = multer({ storage });

// POST /api/user/profile-picture  (multipart/form-data, field: "image")
router.post('/profile-picture', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filename = req.file.filename;
    const picturePath = `/uploads/${filename}`;

    // Save path to the user document
    await User.findByIdAndUpdate(req.user._id, { profilePicture: picturePath });

    res.json({ profilePicture: picturePath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/user/me — return current user data including profilePicture
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profilePicture: user.profilePicture
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/user/profile — update firstName and lastName
router.put('/profile', protect, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { firstName, lastName },
      { new: true }
    ).select('-password');

    res.json({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profilePicture: user.profilePicture
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/user/change-password — verify old password and set new one
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both current and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save(); // triggers the pre-save hash

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/user/expense-categories — get user's expense categories
router.get('/expense-categories', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('expenseCategories');
    res.json({ expenseCategories: user.expenseCategories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/user/expense-categories — add a new expense category
router.post('/expense-categories', protect, async (req, res) => {
  try {
    const { category } = req.body;
    
    if (!category || !category.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const user = await User.findById(req.user._id);
    
    if (user.expenseCategories.includes(category.trim())) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    user.expenseCategories.push(category.trim());
    await user.save();

    res.json({ expenseCategories: user.expenseCategories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/user/expense-categories/:category — delete an expense category
router.delete('/expense-categories/:category', protect, async (req, res) => {
  try {
    const { category } = req.params;
    const user = await User.findById(req.user._id);
    
    user.expenseCategories = user.expenseCategories.filter(c => c !== decodeURIComponent(category));
    await user.save();

    res.json({ expenseCategories: user.expenseCategories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/user/archived-books — get archived books
router.get('/archived-books', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('archivedBooks');
    res.json({ archivedBooks: user.archivedBooks || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/user/current-book — get current book being read
router.get('/current-book', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('currentBook');
    res.json(user.currentBook);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/user/current-book — set a new book to read
router.post('/current-book', protect, async (req, res) => {
  try {
    const { bookName, targetPages } = req.body;
    
    if (!bookName || !bookName.trim()) {
      return res.status(400).json({ message: 'Book name is required' });
    }
    if (!targetPages || targetPages <= 0) {
      return res.status(400).json({ message: 'Target pages must be greater than 0' });
    }

    const user = await User.findById(req.user._id);
    user.currentBook = {
      bookName: bookName.trim(),
      targetPages: parseInt(targetPages),
      startDate: new Date().toISOString().split('T')[0],
      isActive: true
    };
    await user.save();

    res.json(user.currentBook);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/user/current-book — update current book (mark as completed and archive)
router.put('/current-book', protect, async (req, res) => {
  try {
    const { isActive, finalPage } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user.currentBook.bookName) {
      return res.status(400).json({ message: 'No active book' });
    }

    // If marking as inactive (finishing), archive the book
    if (isActive === false && user.currentBook.isActive === true) {
      const archivedBook = {
        bookName: user.currentBook.bookName,
        targetPages: user.currentBook.targetPages,
        startDate: user.currentBook.startDate,
        completionDate: new Date().toISOString().split('T')[0],
        finalPage: finalPage || user.currentBook.targetPages
      };
      
      if (!user.archivedBooks) {
        user.archivedBooks = [];
      }
      user.archivedBooks.push(archivedBook);
      user.currentBook = {
        bookName: '',
        targetPages: 0,
        startDate: '',
        isActive: false
      };
    } else {
      user.currentBook.isActive = isActive !== undefined ? isActive : false;
    }
    
    await user.save();

    res.json({
      currentBook: user.currentBook,
      archivedBooks: user.archivedBooks || []
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

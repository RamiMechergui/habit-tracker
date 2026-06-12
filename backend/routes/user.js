const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `user_${req.user._id}${path.extname(file.originalname)}`)
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error('Only image files are allowed (JPEG, PNG, WebP, GIF)'));
    }
    cb(null, true);
  }
});

// POST /api/user/profile-picture
router.post('/profile-picture', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const picturePath = `/uploads/${req.file.filename}`;
    await User.findByIdAndUpdate(req.user._id, { profilePicture: picturePath });
    res.json({ profilePicture: picturePath });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}, (err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File size exceeds 5 MB limit' });
  }
  if (err) return res.status(400).json({ message: err.message });
});

// GET /api/user/me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profilePicture: user.profilePicture || null
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/user/profile-picture
router.get('/profile-picture', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('profilePicture');
    res.json({ profilePicture: user.profilePicture || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/user/profile — update firstName / lastName
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
      profilePicture: user.profilePicture || null
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/user/change-password
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
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

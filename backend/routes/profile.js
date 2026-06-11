const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Avatar = require('../models/Avatar');
const Settings = require('../models/Settings');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user_${req.user._id}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    return cb(new Error('Only image files allowed (JPEG, PNG, WebP, GIF)'));
  }
  cb(null, true);
};

const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE }, fileFilter });

// ── Profile Picture ──────────────────────────────────────────────
router.post('/avatar', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const filename = req.file.filename;
    const picturePath = `/uploads/${filename}`;

    // Save to both User and Avatar
    await User.findByIdAndUpdate(req.user._id, { profilePicture: picturePath });
    await Avatar.findOneAndUpdate(
      { userId: req.user._id.toString() },
      { profilePicture: picturePath },
      { upsert: true }
    );

    res.json({ profilePicture: picturePath });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}, (err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File size exceeds 5MB' });
  }
  if (err) return res.status(400).json({ message: err.message });
  next();
});

// ── User Profile (firstName, lastName, theme) ────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const settings = await Settings.findOne({ userId: req.user._id.toString() });
    res.json({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profilePicture: user.profilePicture,
      theme: settings?.theme || 'dark',
      expenseCategories: user.expenseCategories,
      recurringTasks: settings?.recurringTasks || {},
      timelinePrefs: settings?.timelinePrefs || { defaultDuration: 30, intervalGranularity: 30 }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/', protect, async (req, res) => {
  try {
    const { firstName, lastName, theme, recurringTasks, timelinePrefs } = req.body;

    // Only update name fields if explicitly provided — avoids wiping names when
    // only settings (theme, recurringTasks, etc.) are being saved
    const nameUpdate = {};
    if (firstName !== undefined) nameUpdate.firstName = firstName;
    if (lastName !== undefined) nameUpdate.lastName = lastName;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      nameUpdate,
      { new: true }
    ).select('-password');

    const updateFields = {};
    if (theme !== undefined) updateFields.theme = theme;
    if (recurringTasks !== undefined) updateFields.recurringTasks = recurringTasks;
    if (timelinePrefs !== undefined) updateFields.timelinePrefs = timelinePrefs;

    if (Object.keys(updateFields).length > 0) {
      await Settings.findOneAndUpdate(
        { userId: req.user._id.toString() },
        updateFields,
        { upsert: true, new: true }
      );
    }

    const settings = await Settings.findOne({ userId: req.user._id.toString() });
    res.json({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profilePicture: user.profilePicture,
      theme: settings?.theme || 'dark',
      expenseCategories: user.expenseCategories,
      recurringTasks: settings?.recurringTasks || {},
      timelinePrefs: settings?.timelinePrefs || { defaultDuration: 30, intervalGranularity: 30 }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Change Password ──────────────────────────────────────────────
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be >= 6 chars' });

    const user = await User.findById(req.user._id);
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return res.status(401).json({ message: 'Current password incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
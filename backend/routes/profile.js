const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Settings = require('../models/Settings');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `user_${req.user._id}${path.extname(file.originalname)}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error('Only image files allowed (JPEG, PNG, WebP, GIF)'));
    }
    cb(null, true);
  }
});

// POST /api/profile/avatar  (multipart, field: "image")
router.post('/avatar', protect, upload.single('image'), async (req, res) => {
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
    return res.status(400).json({ message: 'File size exceeds 5 MB' });
  }
  if (err) return res.status(400).json({ message: err.message });
});

// GET /api/profile  — full profile + settings
router.get('/', protect, async (req, res) => {
  try {
    const [user, settings] = await Promise.all([
      User.findById(req.user._id).select('-password'),
      Settings.findOne({ userId: req.user._id.toString() })
    ]);
    res.json({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profilePicture: user.profilePicture || null,
      theme: settings?.theme || 'dark',
      expenseCategories: user.expenseCategories,
      recurringTasks: settings?.recurringTasks || {},
      timelinePrefs: settings?.timelinePrefs || { defaultDuration: 30, intervalGranularity: 30 }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/profile  — update name and/or settings
router.put('/', protect, async (req, res) => {
  try {
    const { firstName, lastName, theme, recurringTasks, timelinePrefs } = req.body;

    // Only patch name fields if explicitly provided
    const nameUpdate = {};
    if (firstName !== undefined) nameUpdate.firstName = firstName;
    if (lastName !== undefined) nameUpdate.lastName = lastName;

    const [user] = await Promise.all([
      User.findByIdAndUpdate(req.user._id, nameUpdate, { new: true }).select('-password'),
      (() => {
        const fields = {};
        if (theme !== undefined) fields.theme = theme;
        if (recurringTasks !== undefined) fields.recurringTasks = recurringTasks;
        if (timelinePrefs !== undefined) fields.timelinePrefs = timelinePrefs;
        if (Object.keys(fields).length === 0) return Promise.resolve();
        return Settings.findOneAndUpdate(
          { userId: req.user._id.toString() },
          fields,
          { upsert: true, new: true }
        );
      })()
    ]);

    const settings = await Settings.findOne({ userId: req.user._id.toString() });
    res.json({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profilePicture: user.profilePicture || null,
      theme: settings?.theme || 'dark',
      expenseCategories: user.expenseCategories,
      recurringTasks: settings?.recurringTasks || {},
      timelinePrefs: settings?.timelinePrefs || { defaultDuration: 30, intervalGranularity: 30 }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/profile/change-password
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both passwords required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be >= 6 chars' });
    }
    const user = await User.findById(req.user._id);
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ message: 'Current password incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
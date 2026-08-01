const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { protect }                 = require('../middleware/auth');
const { getUserById, updateUser } = require('../db/users');
const { getSettings, upsertSettings } = require('../db/settings');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, `user_${req.user.userId}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits:     { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error('Only image files allowed (JPEG, PNG, WebP, GIF)'));
    }
    cb(null, true);
  },
});

// POST /api/profile/avatar  (multipart, field: "image")
router.post('/avatar', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const picturePath = `/uploads/${req.file.filename}`;
    await updateUser(req.user.userId, { profilePicture: picturePath });
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

// GET /api/profile — full profile + settings
router.get('/', protect, async (req, res) => {
  try {
    const [user, settings] = await Promise.all([
      getUserById(req.user.userId),
      getSettings(req.user.userId),
    ]);
    res.json({
      firstName:         user.firstName,
      lastName:          user.lastName,
      email:             user.email,
      profilePicture:    user.profilePicture || null,
      theme:             settings.theme          || 'dark',
      expenseCategories: user.expenseCategories,
      recurringTasks:    settings.recurringTasks  || {},
      timelinePrefs:     settings.timelinePrefs   || { defaultDuration: 30, intervalGranularity: 30 },
      noteSections:      settings.noteSections    || ['General', 'App Development'],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/profile — update name and/or settings
router.put('/', protect, async (req, res) => {
  try {
    const { firstName, lastName, theme, recurringTasks, timelinePrefs, noteSections } = req.body;

    const nameUpdate = {};
    if (firstName !== undefined) nameUpdate.firstName = firstName;
    if (lastName  !== undefined) nameUpdate.lastName  = lastName;

    const settingsUpdate = {};
    if (theme          !== undefined) settingsUpdate.theme          = theme;
    if (recurringTasks !== undefined) settingsUpdate.recurringTasks = recurringTasks;
    if (timelinePrefs  !== undefined) settingsUpdate.timelinePrefs  = timelinePrefs;
    if (noteSections   !== undefined) settingsUpdate.noteSections   = noteSections;

    const [user, settings] = await Promise.all([
      Object.keys(nameUpdate).length ? updateUser(req.user.userId, nameUpdate) : getUserById(req.user.userId),
      Object.keys(settingsUpdate).length ? upsertSettings(req.user.userId, settingsUpdate) : getSettings(req.user.userId),
    ]);

    res.json({
      firstName:         user.firstName,
      lastName:          user.lastName,
      email:             user.email,
      profilePicture:    user.profilePicture || null,
      theme:             settings.theme          || 'dark',
      expenseCategories: user.expenseCategories,
      recurringTasks:    settings.recurringTasks  || {},
      timelinePrefs:     settings.timelinePrefs   || { defaultDuration: 30, intervalGranularity: 30 },
      noteSections:      settings.noteSections    || ['General', 'Home Notes', 'Dev Notes', 'Work Notes', 'Personal Notes', 'App Development'],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/profile/change-password
router.put('/change-password', protect, async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both passwords required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be >= 6 chars' });
    }
    const user  = await getUserById(req.user.userId);
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(401).json({ message: 'Current password incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await updateUser(req.user.userId, { passwordHash: newHash });
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
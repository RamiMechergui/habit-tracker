const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { protect } = require('../middleware/auth');
const { updateUser } = require('../db/users');
const avatarDb = require('../db/avatarHistory');
const storage = require('../services/storage');

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const HISTORY_LIMIT = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP, GIF allowed'));
    }
    cb(null, true);
  },
});

function getObjectKey(userId, versionNumber, ext) {
  return `avatars/${userId}/v${versionNumber}${ext}`;
}

function getImageUrl(objectKey) {
  if (!objectKey) return '';
  return `/api/avatar/images/${encodeURIComponent(objectKey)}`;
}

// POST /api/avatar/upload — upload new avatar
router.post('/upload', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const { userId } = req.user;
    const ext = storage.extFromMime(req.file.mimetype) || '.jpg';
    const versionNumber = await avatarDb.getNextVersionNumber(userId);
    const objectKey = getObjectKey(userId, versionNumber, ext);

    // Upload to MinIO
    await storage.uploadImage(objectKey, req.file.buffer, req.file.mimetype);

    // Enforce history limit — delete oldest versions beyond limit
    const history = await avatarDb.getHistoryByUser(userId);
    if (history.length >= HISTORY_LIMIT) {
      const toDelete = history.slice(HISTORY_LIMIT - 1);
      for (const v of toDelete) {
        await storage.deleteImage(v.objectKey);
        await avatarDb.deleteVersion(userId, v.versionId);
      }
    }

    // Create history entry
    const version = await avatarDb.createVersion(
      userId, objectKey, req.file.mimetype, req.file.size,
    );

    // Unset previous current, set this one as current
    await avatarDb.unsetCurrentVersion(userId);
    await avatarDb.setCurrentVersion(userId, version.versionId);

    // Update user profile
    const avatarUrl = getImageUrl(objectKey);
    await updateUser(userId, {
      profilePicture: avatarUrl,
      avatarVersion: versionNumber,
    });

    res.json({
      versionId:     version.versionId,
      versionNumber: version.versionNumber,
      objectKey,
      url:           avatarUrl,
    });
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size exceeds 5 MB' });
    }
    res.status(500).json({ message: err.message });
  }
});

// GET /api/avatar/history — list all avatar versions
router.get('/history', protect, async (req, res) => {
  try {
    const history = await avatarDb.getHistoryByUser(req.user.userId);
    const items = history.map(v => ({
      versionId:     v.versionId,
      versionNumber: v.versionNumber,
      url:           getImageUrl(v.objectKey),
      isCurrent:     v.isCurrent,
      fileSize:      v.fileSize,
      createdAt:     v.createdAt,
    }));
    res.json({ items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/avatar/revert — revert to a previous version
router.post('/revert', protect, async (req, res) => {
  try {
    const { versionId } = req.body;
    if (!versionId) return res.status(400).json({ message: 'versionId required' });

    const version = await avatarDb.getVersionById(req.user.userId, versionId);
    if (!version) return res.status(404).json({ message: 'Version not found' });

    if (version.isCurrent) {
      return res.json({ message: 'Already current', url: getImageUrl(version.objectKey), versionNumber: version.versionNumber });
    }

    // Unset old current, set new current
    await avatarDb.unsetCurrentVersion(req.user.userId);
    await avatarDb.setCurrentVersion(req.user.userId, versionId);

    // Update user profile
    const avatarUrl = getImageUrl(version.objectKey);
    await updateUser(req.user.userId, {
      profilePicture: avatarUrl,
      avatarVersion: version.versionNumber,
    });

    res.json({
      message: 'Avatar reverted',
      url:     avatarUrl,
      versionNumber: version.versionNumber,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/avatar/history/:versionId — delete a version
router.delete('/history/:versionId', protect, async (req, res) => {
  try {
    const { versionId } = req.params;
    const version = await avatarDb.getVersionById(req.user.userId, versionId);
    if (!version) return res.status(404).json({ message: 'Version not found' });

    // Delete from MinIO
    await storage.deleteImage(version.objectKey);

    // Delete from DB
    await avatarDb.deleteVersion(req.user.userId, versionId);

    // If it was the current, clear the profile picture
    if (version.isCurrent) {
      await updateUser(req.user.userId, { profilePicture: '', avatarVersion: 0 });
    }

    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

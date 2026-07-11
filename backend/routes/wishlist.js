const express = require('express');
const router = express.Router();
const multer = require('multer');
const { randomUUID } = require('crypto');
const { protect } = require('../middleware/auth');
const storage = require('../services/storage');
const { getAll, createItem, updateItem, deleteItem } = require('../db/wishlist');

router.use(protect);

const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG and PNG files are allowed'));
  },
});

router.get('/', async (req, res) => {
  try {
    const items = await getAll(req.user.userId);
    res.json(items);
  } catch (err) {
    console.error('[Wishlist] GET error:', err);
    res.status(500).json({ message: 'Failed to fetch wishlist' });
  }
});

router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const { name, price, url, currency } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Item name is required' });
    }
    let photoUrl = '';
    if (req.file) {
      const objectKey = `wishlist/${req.user.userId}/${randomUUID()}`;
      const result = await storage.uploadImage(objectKey, req.file.buffer, req.file.mimetype);
      photoUrl = `/api/wishlist/images/${encodeURIComponent(result.key)}`;
    }
    const item = await createItem(req.user.userId, { name: name.trim(), price, url, photoUrl, currency });
    res.status(201).json(item);
  } catch (err) {
    console.error('[Wishlist] POST error:', err);
    res.status(500).json({ message: err.message || 'Failed to create item' });
  }
});

router.put('/:id', upload.single('photo'), async (req, res) => {
  try {
    const { name, price, url, currency, existingPhoto } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (price !== undefined) updates.price = price;
    if (url !== undefined) updates.url = url;
    if (currency !== undefined) updates.currency = currency;
    if (req.file) {
      const { randomUUID } = require('crypto');
      const objectKey = `wishlist/${req.user.userId}/${randomUUID()}`;
      const result = await storage.uploadImage(objectKey, req.file.buffer, req.file.mimetype);
      updates.photoUrl = `/api/wishlist/images/${encodeURIComponent(result.key)}`;
    } else if (existingPhoto !== undefined) {
      updates.photoUrl = existingPhoto || '';
    }
    const item = await updateItem(req.user.userId, req.params.id, updates);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(item);
  } catch (err) {
    console.error('[Wishlist] PUT error:', err);
    res.status(500).json({ message: err.message || 'Failed to update item' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteItem(req.user.userId, req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[Wishlist] DELETE error:', err);
    res.status(500).json({ message: 'Failed to delete item' });
  }
});

module.exports = router;

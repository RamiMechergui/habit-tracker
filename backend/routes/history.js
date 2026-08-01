const express = require('express');
const router  = express.Router();
const { protect }               = require('../middleware/auth');
const { getUserById, updateUser } = require('../db/users');

// Keep at most this many history entries per user. History is stored inside the
// user item in DynamoDB (400 KB limit) — an unbounded array can blow past it
// and make every updateUser() call fail.
const HISTORY_LIMIT = 100;

function detectDevice(ua) {
  if (!ua) return 'Unknown';
  const s = ua.toLowerCase();
  if (s.includes('iphone') || s.includes('ipad') || s.includes('ipod')) return 'Mobile';
  if (s.includes('android') && s.includes('mobile')) return 'Mobile';
  if (s.includes('android') && !s.includes('mobile')) return 'Tablet';
  if (s.includes('tablet') || s.includes('kindle') || s.includes('playbook')) return 'Tablet';
  if (s.includes('windows phone')) return 'Mobile';
  if (s.includes('mobile')) return 'Mobile';
  return 'Desktop';
}

// GET /api/history
router.get('/', protect, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);
    res.json({ history: user.history || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/history — add a history entry
router.post('/', protect, async (req, res) => {
  try {
    const { action, description } = req.body;
    if (!action) return res.status(400).json({ message: 'action is required' });

    const ua = req.headers['user-agent'] || '';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'Unknown';
    const device = detectDevice(ua);

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      action,
      description: description || action,
      ip,
      device,
      userAgent: ua.slice(0, 300),
      timestamp: new Date().toISOString(),
    };

    const user = await getUserById(req.user.userId);
    const history = [...(user.history || []), entry].slice(-HISTORY_LIMIT);
    const updated = await updateUser(req.user.userId, { history });
    res.status(201).json(updated.history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

const express = require('express');
const router  = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const sessionsDb  = require('../db/sessions');

const revokeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { message: 'Too many session revocation attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/sessions — list all sessions (active + history)
router.get('/', protect, async (req, res) => {
  try {
    const [active, all] = await Promise.all([
      sessionsDb.listActiveSessions(req.user.userId),
      sessionsDb.listAllSessions(req.user.userId),
    ]);

    const currentSessionId = req.sessionId;

    if (!currentSessionId && active.length === 0) {
      const session = await sessionsDb.createSession(req.user.userId, {
        ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'Unknown',
        userAgent: req.headers['user-agent'] || '',
      });
      return res.json({
        sessions: [{ ...session, isCurrent: true }],
        history: [],
      });
    }

    const mapped = active.map(s => ({
      ...s,
      isCurrent: s.sessionId === currentSessionId,
    }));

    const history = all
      .filter(h => h.isRevoked)
      .sort((a, b) => (b.revokedAt || b.createdAt) > (a.revokedAt || a.createdAt) ? 1 : -1)
      .slice(0, 50);

    res.json({ sessions: mapped, history });
  } catch (err) {
    console.error('[Sessions] Error:', err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/sessions/:id — revoke a specific session
router.delete('/:id', protect, revokeLimiter, async (req, res) => {
  try {
    const sessionId = req.params.id;

    if (sessionId === req.sessionId) {
      return res.status(400).json({ message: 'Cannot revoke your own active session. Use logout instead.' });
    }

    const ok = await sessionsDb.revokeSession(req.user.userId, sessionId);
    if (!ok) return res.status(404).json({ message: 'Session not found' });

    res.json({ success: true, message: 'Session revoked' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sessions/heartbeat — keep session alive & mark connected
router.post('/heartbeat', protect, async (req, res) => {
  if (req.sessionId) {
    await sessionsDb.touchSession(req.user.userId, req.sessionId);
  }
  res.json({ success: true });
});

module.exports = router;

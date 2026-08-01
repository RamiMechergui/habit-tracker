const express              = require('express');
const router               = express.Router();
const jwt                  = require('jsonwebtoken');
const bcrypt               = require('bcryptjs');
const { randomUUID }       = require('crypto');
const { createUser, getUserById, getUserByEmail, updateUser } = require('../db/users');
const { protect }          = require('../middleware/auth');
const sessionsDb           = require('../db/sessions');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_prod';

// Keep history bounded inside the user's DynamoDB item (400 KB limit).
const HISTORY_LIMIT = 100;

const generateToken = (id, sessionId) => jwt.sign({ id, sid: sessionId }, JWT_SECRET, { expiresIn: '30d' });

const cookieOpts = (req) => ({
  httpOnly: true,
  secure:   req.secure || req.headers['x-forwarded-proto'] === 'https',
  sameSite: 'lax',
  maxAge:   30 * 24 * 60 * 60 * 1000,
});

function detectDevice(ua) {
  if (!ua) return 'Desktop';
  const s = ua.toLowerCase();
  if (s.includes('iphone') || s.includes('ipad') || s.includes('ipod') || (s.includes('android') && s.includes('mobile')) || s.includes('windows phone') || s.includes('mobile')) return 'Mobile';
  if (s.includes('android') || s.includes('tablet') || s.includes('kindle') || s.includes('playbook')) return 'Tablet';
  return 'Desktop';
}

async function logHistoryEntry(user, action, description, req) {
  try {
    const ua = req.headers['user-agent'] || '';
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'Unknown';
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      action,
      description,
      ip,
      device: detectDevice(ua),
      userAgent: ua.slice(0, 300),
      timestamp: new Date().toISOString(),
    };
    const history = [...(user.history || []), entry].slice(-HISTORY_LIMIT);
    await updateUser(user.userId, { history }).catch(() => {});
  } catch (_) {}
}

// POST /register
router.post('/register', async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }
  try {
    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const userId       = randomUUID();
    const user         = await createUser({ userId, email, passwordHash, firstName: firstName || '', lastName: lastName || '' });

    const session = await sessionsDb.createSession(userId, {
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'Unknown',
      userAgent: req.headers['user-agent'] || '',
    });

    logHistoryEntry(user, 'register', 'User registered a new account', req);

    const token = generateToken(userId, session.sessionId);
    res.cookie('habitToken', token, cookieOpts(req));
    res.status(201).json({
      _id:               user._id,
      firstName:         user.firstName,
      lastName:          user.lastName,
      email:             user.email,
      profilePicture:    user.profilePicture || null,
      expenseCategories: user.expenseCategories,
      token,
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)  return res.status(401).json({ message: 'Invalid email or password' });

    const session = await sessionsDb.createSession(user.userId, {
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'Unknown',
      userAgent: req.headers['user-agent'] || '',
    });

    logHistoryEntry(user, 'login', 'User logged in', req);

    const token = generateToken(user.userId, session.sessionId);
    res.cookie('habitToken', token, cookieOpts(req));
    res.json({
      _id:               user._id,
      firstName:         user.firstName,
      lastName:          user.lastName,
      email:             user.email,
      profilePicture:    user.profilePicture || null,
      expenseCategories: user.expenseCategories,
      token,
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /logout
router.post('/logout', async (req, res) => {
  const token = req.cookies?.habitToken || req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.sid) {
        await sessionsDb.disconnectSession(decoded.id, decoded.sid).catch(() => {});
      }
    } catch (_) {}
  }
  res.clearCookie('habitToken', cookieOpts(req));
  res.json({ message: 'Logged out' });
});

// POST /verify-password
router.post('/verify-password', protect, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ message: 'Password is required' });
  try {
    const user  = await getUserById(req.user.userId);
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ message: 'Invalid password' });
    res.json({ success: true, message: 'Password verified successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /change-password — password change with cascade option
router.put('/change-password', protect, async (req, res) => {
  const { currentPassword, newPassword, logoutOtherDevices } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Both passwords required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be >= 6 chars' });
  }
  try {
    const user  = await getUserById(req.user.userId);
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(401).json({ message: 'Current password incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await updateUser(req.user.userId, { passwordHash: newHash });

    logHistoryEntry(user, 'password_change', 'Changed account password', req);

    // Cascade: revoke all other sessions if requested
    if (logoutOtherDevices && req.sessionId) {
      const revoked = await sessionsDb.revokeAllSessionsExcept(req.user.userId, req.sessionId);
      if (revoked > 0) {
        logHistoryEntry(user, 'sessions_revoked', `Logged out ${revoked} other device(s) after password change`, req);
      }
    }

    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /verify
router.get('/verify', async (req, res) => {
  const token = req.cookies.habitToken || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user    = await getUserById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    // If JWT has a sessionId, verify it's not revoked
    if (decoded.sid) {
      const session = await sessionsDb.getSession(decoded.id, decoded.sid);
      if (!session || session.isRevoked) {
        return res.status(401).json({ message: 'Session revoked, please log in again' });
      }
    }

    res.json({
      userId:       user.userId,
      email:        user.email,
      firstName:    user.firstName || '',
      lastName:     user.lastName  || '',
      profilePicture: user.profilePicture || null,
      verified:     true,
    });
  } catch {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
});

module.exports = router;

const express              = require('express');
const router               = express.Router();
const jwt                  = require('jsonwebtoken');
const bcrypt               = require('bcryptjs');
const { randomUUID }       = require('crypto');
const { createUser, getUserById, getUserByEmail, updateUser } = require('../db/users');
const { protect }          = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_prod';

const generateToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });

const cookieOpts = (req) => ({
  httpOnly: true,
  secure:   req.secure || req.headers['x-forwarded-proto'] === 'https',
  sameSite: 'lax',
  maxAge:   30 * 24 * 60 * 60 * 1000, // 30 days
});

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
    // Log registration to history (fire-and-forget)
    try {
      const ua = req.headers['user-agent'] || '';
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'Unknown';
      const s = ua.toLowerCase();
      const device = s.includes('iphone') || s.includes('ipad') || s.includes('ipod') || (s.includes('android') && s.includes('mobile')) || s.includes('windows phone') || s.includes('mobile')
        ? 'Mobile'
        : (s.includes('android') || s.includes('tablet') || s.includes('kindle') || s.includes('playbook')
          ? 'Tablet'
          : 'Desktop');

      const logEntry = {
        id:           Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        action:       'register',
        description:  'User registered a new account',
        ip,
        device,
        userAgent:    ua.slice(0, 300),
        timestamp:    new Date().toISOString(),
      };
      const history = [...(user.history || []), logEntry];
      await updateUser(user.userId, { history }).catch(() => {});
    } catch (_) { /* non-blocking */ }

    const token        = generateToken(userId);
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

    const token = generateToken(user.userId);
    res.cookie('habitToken', token, cookieOpts(req));

    // Log login to history (fire-and-forget)
    try {
      const ua = req.headers['user-agent'] || '';
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'Unknown';
      const s = ua.toLowerCase();
      const device = s.includes('iphone') || s.includes('ipad') || s.includes('ipod') || (s.includes('android') && s.includes('mobile')) || s.includes('windows phone') || s.includes('mobile')
        ? 'Mobile'
        : (s.includes('android') || s.includes('tablet') || s.includes('kindle') || s.includes('playbook')
          ? 'Tablet'
          : 'Desktop');

      const logEntry = {
        id:           Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        action:       'login',
        description:  'User logged in',
        ip,
        device,
        userAgent:    ua.slice(0, 300),
        timestamp:    new Date().toISOString(),
      };
      const history = [...(user.history || []), logEntry];
      await updateUser(user.userId, { history }).catch(() => {});
    } catch (_) { /* non-blocking */ }

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
router.post('/logout', (req, res) => {
  res.clearCookie('habitToken', cookieOpts(req));
  res.json({ message: 'Logged out successfully' });
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

// GET /verify
router.get('/verify', async (req, res) => {
  const token = req.cookies.habitToken || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user    = await getUserById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User not found' });
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

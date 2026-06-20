const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const { getUserById, deleteUser, countUsers, listUsers } = require('../db/users');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change_this_admin_dashboard_password';
const JWT_SECRET     = process.env.JWT_SECRET     || 'supersecretjwtkey_change_me_in_prod';

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   24 * 60 * 60 * 1000,
};

function adminAuth(req, res, next) {
  const token = req.cookies?.adminToken;
  if (!token) return res.status(401).json({ message: 'Not authenticated' });
  try {
    jwt.verify(token, JWT_SECRET + '_admin');
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired session' });
  }
}

router.post('/session', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Invalid admin password' });
  }
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET + '_admin', { expiresIn: '24h' });
  res.cookie('adminToken', token, COOKIE_OPTS);
  res.json({ success: true });
});

router.get('/session', adminAuth, (_req, res) => {
  res.json({ authenticated: true });
});

router.delete('/session', (_req, res) => {
  res.clearCookie('adminToken', COOKIE_OPTS);
  res.json({ success: true });
});

// GET /api/login/admin/users — count of users
router.get('/users', adminAuth, async (_req, res) => {
  try {
    const count = await countUsers();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/login/admin/users/list
router.get('/users/list', adminAuth, async (_req, res) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/login/admin/users/:id
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await deleteUser(req.params.id);
    res.json({ message: 'User deleted', userId: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

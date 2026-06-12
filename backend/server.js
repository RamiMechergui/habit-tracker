require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cookieParser());

// CORS configuration with credentials support
app.use(cors({
  origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : true,
  credentials: true
}));

// Serve uploaded images statically
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
try { fs.chmodSync(uploadDir, 0o755); } catch (_) {}
app.use('/uploads', express.static(uploadDir));

// Connect to MongoDB
const mongoURI = process.env.MONGO_URI ||
  process.env.MONGO_URL ||
  (process.env.MONGOHOST
    ? `mongodb://${process.env.MONGOUSER}:${process.env.MONGOPASSWORD}@${process.env.MONGOHOST}:${process.env.MONGOPORT}/habittracker?authSource=admin`
    : 'mongodb://mongo:27017/habittracker');

mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/daily',       require('./routes/logs'));
app.use('/api/user',        require('./routes/user'));
app.use('/api/essentials',  require('./routes/essentials'));
app.use('/api/tasks',       require('./routes/tasks'));
app.use('/api/notes',       require('./routes/notes'));
app.use('/api/credentials', require('./routes/credentials'));
app.use('/api/expenses',    require('./routes/expenses'));
app.use('/api/books',       require('./routes/books'));
app.use('/api/profile',     require('./routes/profile'));
app.use('/api/login/admin', require('./routes/admin'));

// ── Flat-path aliases (used by frontend Store) ─────────────────────────────
const authRoutes    = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const booksRoutes   = require('./routes/books');
const expRoutes     = require('./routes/expenses');

// Auth
app.post('/api/login',    (req, res, next) => { req.url = '/login';    authRoutes(req, res, next); });
app.post('/api/register', (req, res, next) => { req.url = '/register'; authRoutes(req, res, next); });
app.post('/api/logout',   (req, res, next) => { req.url = '/logout';   authRoutes(req, res, next); });
app.get('/api/verify',    (req, res, next) => { req.url = '/verify';   authRoutes(req, res, next); });

// Settings / avatar
app.get('/api/settings',  (req, res, next) => { req.url = '/';       profileRoutes(req, res, next); });
app.put('/api/settings',  (req, res, next) => { req.url = '/';       profileRoutes(req, res, next); });
app.get('/api/avatar',    (req, res, next) => { req.url = '/';       profileRoutes(req, res, next); });
app.post('/api/avatar',   (req, res, next) => { req.url = '/avatar'; profileRoutes(req, res, next); });
app.put('/api/login/change-password', (req, res, next) => { req.url = '/change-password'; profileRoutes(req, res, next); });

// Books (frontend Store uses /api/currentbook)
app.get('/api/currentbook',          (req, res, next) => { req.url = '/current';  booksRoutes(req, res, next); });
app.post('/api/currentbook',         (req, res, next) => { req.url = '/current';  booksRoutes(req, res, next); });
app.put('/api/currentbook',          (req, res, next) => { req.url = '/current';  booksRoutes(req, res, next); });
app.get('/api/currentbook/current',  (req, res, next) => { req.url = '/current';  booksRoutes(req, res, next); });
app.get('/api/currentbook/archived', (req, res, next) => { req.url = '/archived'; booksRoutes(req, res, next); });

// Archives
app.get('/api/archives',  (req, res, next) => { req.url = '/archived'; booksRoutes(req, res, next); });
app.post('/api/archives', (req, res) => res.json({ success: true, ...req.body }));

// Categories
app.get('/api/categories',              (req, res, next) => { req.url = '/categories/list';             expRoutes(req, res, next); });
app.post('/api/categories',             (req, res, next) => { req.url = '/categories';                  expRoutes(req, res, next); });
app.put('/api/categories/:category',    (req, res, next) => { req.url = '/categories/' + req.params.category; expRoutes(req, res, next); });
app.delete('/api/categories/:category', (req, res, next) => { req.url = '/categories/' + req.params.category; expRoutes(req, res, next); });

// Notification stubs — return empty so the frontend doesn't error
app.get('/api/notifications',                 (_req, res) => res.json({ notifications: [], total: 0 }));
app.get('/api/notifications/count',           (_req, res) => res.json({ unread: 0 }));
app.put('/api/notifications/:id/read',        (_req, res) => res.json({ success: true }));
app.put('/api/notifications/read-all',        (_req, res) => res.json({ success: true }));
app.delete('/api/notifications/:id',          (_req, res) => res.json({ success: true }));
app.post('/api/notifications/subscribe',      (_req, res) => res.json({ success: true }));
app.get('/api/notifications/vapidPublicKey',  (_req, res) => res.json({ publicKey: '' }));

// SSE delivery stream — not available; return 204 to stop reconnects
app.get('/api/delivery/stream', (_req, res) => res.status(204).end());

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
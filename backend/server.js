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
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
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
const authRoutes         = require('./routes/auth');
const logRoutes          = require('./routes/logs');
const userRoutes         = require('./routes/user');
const essentialsRoutes   = require('./routes/essentials');
const tasksRoutes        = require('./routes/tasks');
const notesRoutes        = require('./routes/notes');
const credentialsRoutes  = require('./routes/credentials');
const habitsRoutes       = require('./routes/habits');
const expensesRoutes     = require('./routes/expenses');
const booksRoutes        = require('./routes/books');
const profileRoutes      = require('./routes/profile');
const analyticsRoutes    = require('./routes/analytics');
const adminRoutes        = require('./routes/admin');

app.use('/api/auth', authRoutes);
app.use('/api/daily', logRoutes);
app.use('/api/user', userRoutes);
app.use('/api/essentials', essentialsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/credentials', credentialsRoutes);
app.use('/api/habits', habitsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/login/admin', adminRoutes);

// ── Monolithic aliases for flat microservice-compatible paths ──────────
// Auth paths
app.post('/api/login',                (req, res, next) => { req.url = '/login';           authRoutes(req, res, next); });
app.post('/api/register',             (req, res, next) => { req.url = '/register';        authRoutes(req, res, next); });
app.post('/api/logout',               (req, res, next) => { req.url = '/logout';          authRoutes(req, res, next); });
app.get('/api/verify',                (req, res, next) => { req.url = '/verify';          authRoutes(req, res, next); });

// User profile/avatar paths
app.get('/api/settings',              (req, res, next) => { req.url = '/';                profileRoutes(req, res, next); });
app.put('/api/settings',              (req, res, next) => { req.url = '/';                profileRoutes(req, res, next); });
app.get('/api/avatar',                (req, res, next) => { req.url = '/';                profileRoutes(req, res, next); });
app.post('/api/avatar',               (req, res, next) => { req.url = '/avatar';          profileRoutes(req, res, next); });
app.put('/api/login/change-password', (req, res, next) => { req.url = '/change-password'; profileRoutes(req, res, next); });

// Books
app.post('/api/currentbook',         (req, res, next) => { req.url = '/current';  booksRoutes(req, res, next); });
app.put('/api/currentbook',          (req, res, next) => { req.url = '/current';  booksRoutes(req, res, next); });
app.get('/api/currentbook',          (req, res, next) => { req.url = '/current';  booksRoutes(req, res, next); });
app.get('/api/currentbook/current',  (req, res, next) => { req.url = '/current';  booksRoutes(req, res, next); });
app.get('/api/currentbook/archived', (req, res, next) => { req.url = '/archived'; booksRoutes(req, res, next); });

// Archives
app.get('/api/archives',  (req, res, next) => { req.url = '/archives'; userRoutes(req, res, next); });
app.post('/api/archives', (req, res) => res.json({ success: true, ...req.body }));

// Categories
app.get('/api/categories',              (req, res, next) => { req.url = '/categories/list';                  expensesRoutes(req, res, next); });
app.post('/api/categories',             (req, res, next) => { req.url = '/categories';                       expensesRoutes(req, res, next); });
app.delete('/api/categories/:category', (req, res, next) => { req.url = '/categories/' + req.params.category; expensesRoutes(req, res, next); });

// Notifications stub — return empty list so frontend doesn't error
app.get('/api/notifications',       (req, res) => res.json({ notifications: [], total: 0 }));
app.get('/api/notifications/count', (req, res) => res.json({ unread: 0 }));
app.put('/api/notifications/:id/read',  (req, res) => res.json({ success: true }));
app.put('/api/notifications/read-all',  (req, res) => res.json({ success: true }));
app.delete('/api/notifications/:id',    (req, res) => res.json({ success: true }));
app.post('/api/notifications/subscribe',(req, res) => res.json({ success: true }));
app.get('/api/notifications/vapidPublicKey', (req, res) => res.json({ publicKey: '' }));

// SSE delivery stream — not available; return 204 to stop reconnects
app.get('/api/delivery/stream', (_req, res) => res.status(204).end());

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
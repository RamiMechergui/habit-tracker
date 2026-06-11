require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { Kafka } = require('kafkajs');

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
// Ensure writeable by the node user (Docker named volumes are owned by root)
try { fs.chmodSync(uploadDir, 0o755); } catch (_) {}
app.use('/uploads', express.static(uploadDir));

// Connect to MongoDB
const mongoURI = process.env.MONGO_URI || 
                 process.env.MONGO_URL || 
                 (process.env.MONGOHOST ? `mongodb://${process.env.MONGOUSER}:${process.env.MONGOPASSWORD}@${process.env.MONGOHOST}:${process.env.MONGOPORT}/habittracker?authSource=admin` : 'mongodb://mongo:27017/habittracker');

mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Kafka Setup (monolithic mode - single producer)
const kafka = new Kafka({
  clientId: 'habit-tracker-monolith',
  brokers: [(process.env.KAFKA_BROKER || 'kafka:9092')],
  retry: { retries: 5, initialRetryTime: 300 }
});
const kafkaProducer = kafka.producer();

async function connectKafka() {
  try {
    await kafkaProducer.connect();
    console.log('[Kafka] Producer connected');
  } catch (err) {
    console.error('[Kafka] Connection error:', err.message);
  }
}

// Routes
const authRoutes         = require('./routes/auth');
const logRoutes          = require('./routes/logs');
const userRoutes         = require('./routes/user');
const essentialsRoutes   = require('./routes/essentials');
const notificationsRoutes = require('./routes/notifications');
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
app.use('/api/notifications', notificationsRoutes);
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
// The frontend uses flat paths (/api/login, /api/register, /api/settings,
// /api/avatar, /api/categories, /api/currentbook, /api/archives, ...)
// which Docker/nginx routes to individual microservices. This section makes
// those same paths work when running the monolithic backend.

// Flat aliases — rewrite req.url to match the sub-route and pass to the router
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

// Books — the frontend calls /api/currentbook (bare) for POST/create and PUT/finish.
// booksRoutes has handlers at /current, /archived.
app.post('/api/currentbook',   (req, res, next) => { req.url = '/current';  booksRoutes(req, res, next); });
app.put('/api/currentbook',    (req, res, next) => { req.url = '/current';  booksRoutes(req, res, next); });
app.get('/api/currentbook',    (req, res, next) => { req.url = '/current';  booksRoutes(req, res, next); });
app.get('/api/currentbook/current', (req, res, next) => { req.url = '/current';  booksRoutes(req, res, next); });
app.get('/api/currentbook/archived',(req, res, next) => { req.url = '/archived'; booksRoutes(req, res, next); });

// Archives — the frontend calls /api/archives for POST/create and GET/list
// GET uses userRoutes (has router.get('/archives', ...) returning { archivedBooks }).
// POST for archiving is a legacy microservices call — the monolithic PUT /api/currentbook
// already pushes to archivedBooks, so we just echo the body as a no-op success.
app.get('/api/archives',  (req, res, next) => { req.url = '/archives'; userRoutes(req, res, next); });
app.post('/api/archives', (req, res) => res.json({ success: true, ...req.body }));

// Categories — the frontend calls /api/categories for all CRUD operations on expense categories.
// The expensesRoutes has handlers at /categories, /categories/list, /categories/:category.
app.get('/api/categories',                  (req, res, next) => { req.url = '/categories/list';                expensesRoutes(req, res, next); });
app.post('/api/categories',                 (req, res, next) => { req.url = '/categories';                     expensesRoutes(req, res, next); });
app.delete('/api/categories/:category',     (req, res, next) => { req.url = '/categories/' + req.params.category; expensesRoutes(req, res, next); });

// SSE delivery stream — not available in monolithic mode; return graceful 503
// so the frontend EventSource fails fast rather than hanging indefinitely
app.get('/api/delivery/stream', (_req, res) => {
  res.status(503).json({
    message: 'Delivery service not available in monolithic mode. Real-time push is disabled.'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  connectKafka();
  startReminderPoller();
  startEssentialsCron();
});

// ── Task Reminder Poller ──────────────────────────────────────────────────────
// Runs every 60s, fires notifications for due reminders
function startReminderPoller() {
  const ScheduledReminder = require('./models/ScheduledReminder');
  const Notification      = require('./models/Notification');
  const User              = require('./models/User');
  const webpush           = require('web-push');

  setInterval(async () => {
    try {
      const now  = new Date();
      const soon = new Date(now.getTime() + 61000); // next minute window
      const due  = await ScheduledReminder.find({ fired: false, fireAt: { $lte: soon } });

      for (const rem of due) {
        const messageText = `⏰ Reminder: "${rem.taskTitle}" is coming up${rem.reminderMinutes > 0 ? ` in ${rem.reminderMinutes} minutes` : ' now'}!`;

        // Create notification
        const eventId = `task_reminder_${rem.taskId}_${rem.date}`;
        const exists  = await Notification.findOne({ eventId });
        if (!exists) {
          await Notification.create({
            userId:       rem.userId,
            taskId:       rem.taskId,
            taskTitle:    rem.taskTitle,
            scheduledFor: rem.fireAt,
            message:      messageText,
            type:         'task_reminder',
            status:       'UNREAD',
            eventId,
          });
        }
        
        // Push notification
        const user = await User.findById(rem.userId);
        if (user && user.pushSubscription) {
          try {
            await webpush.sendNotification(user.pushSubscription, JSON.stringify({
              title: 'Task Reminder',
              body: messageText,
              taskId: rem.taskId,
              url: '/tasks'
            }));
          } catch (pushErr) {
            console.error('[ReminderPoller] Push Error:', pushErr.message);
          }
        }

        // Mark as fired
        rem.fired = true;
        await rem.save();
        console.log(`[ReminderPoller] Fired reminder for task "${rem.taskTitle}" (user ${rem.userId})`);
      }
    } catch (e) {
      console.error('[ReminderPoller] Error:', e.message);
    }
  }, 60000);

  console.log('[ReminderPoller] Started (60s interval)');
}

// ── Essentials Cron Job (checks for low/out items daily) ──────────────────────
function startEssentialsCron() {
  const User = require('./models/User');
  const Notification = require('./models/Notification');

  // Run daily at 9 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('[EssentialsCron] Running daily check...');
      const users = await User.find({ 'essentials.status': { $in: ['BS', 'NA'] } });
      
      for (const user of users) {
        for (const item of user.essentials) {
          if (item.status === 'BS' || item.status === 'NA') {
            const eventId = `essentials_${user._id}_${item._id}_${new Date().toISOString().split('T')[0]}`;
            const exists = await Notification.findOne({ eventId });
            if (!exists) {
              const type = item.status === 'NA' ? 'urgent' : 'reminder';
              const message = type === 'urgent' 
                ? `You're out of ${item.name}! Purchase it immediately.`
                : `Running low on ${item.name}. Add it to your shopping list soon!`;
              
              await Notification.create({
                userId:   user._id.toString(),
                itemId:   item._id.toString(),
                itemName: item.name,
                message,
                type,
                eventId,
              });
              console.log(`[EssentialsCron] Created ${type} notification for ${item.name} (user ${user._id})`);
            }
          }
        }
      }
    } catch (e) {
      console.error('[EssentialsCron] Error:', e.message);
    }
  });

  console.log('[EssentialsCron] Scheduled (daily at 9 AM)');
}

module.exports = app;
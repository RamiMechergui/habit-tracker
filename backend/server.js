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
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Serve uploaded images statically
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Connect to MongoDB
const mongoURI = process.env.MONGO_URI || 
                 process.env.MONGO_URL || 
                 (process.env.MONGOHOST ? `mongodb://${process.env.MONGOUSER}:${process.env.MONGOPASSWORD}@${process.env.MONGOHOST}:${process.env.MONGOPORT}/habittracker?authSource=admin` : 'mongodb://mongo:27017/habittracker');

mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
const authRoutes         = require('./routes/auth');
const logRoutes          = require('./routes/logs');
const userRoutes         = require('./routes/user');
const essentialsRoutes   = require('./routes/essentials');
const notificationsRoutes = require('./routes/notifications');
const tasksRoutes        = require('./routes/tasks');
const notesRoutes        = require('./routes/notes');

app.use('/api/auth', authRoutes);
app.use('/api/daily', logRoutes);
app.use('/api/user', userRoutes);
app.use('/api/essentials', essentialsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/notes', notesRoutes);

// Aliases for monolithic compatibility with microservices frontend
app.use('/api/currentbook', userRoutes);
app.use('/api/archives', userRoutes);
app.use('/api/settings', userRoutes);
app.use('/api/categories', userRoutes);
app.use('/api/avatar', userRoutes);

// ── Monolithic aliases for flat microservice-compatible auth paths ──────
// The frontend uses flat paths (/api/login, /api/register, ...) which
// Docker/nginx routes to individual microservices. This section makes
// those same paths work when running the monolithic backend.

// Delegates: rewrite req.url to match the sub-route and pass to the router
app.put('/api/settings',            (req, res, next) => { req.url = '/profile';           userRoutes(req, res, next); });
app.post('/api/avatar',             (req, res, next) => { req.url = '/profile-picture';   userRoutes(req, res, next); });
app.put('/api/login/change-password', (req, res, next) => { req.url = '/change-password'; userRoutes(req, res, next); });

// Catch-all for flat auth paths: /api/login, /api/register, /api/logout, /api/verify
// Must come AFTER all other /api/* mounts so it only catches unmatched paths.
app.use('/api', authRoutes);

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
  startReminderPoller();
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

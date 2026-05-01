const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { Kafka } = require('kafkajs');
const Notification = require('./models/Notification');
const ProcessedEvent = require('./models/ProcessedEvent');

// ── App Setup ──────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));

// ── JWT Middleware ─────────────────────────────────────────────
const verifyToken = (req, res, next) => {
  let token;
  if (req.cookies.habitToken) token = req.cookies.habitToken;
  else if (req.headers.authorization?.startsWith('Bearer '))
    token = req.headers.authorization.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Not authorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_prod');
    req.user = { _id: decoded.id };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// ── Kafka Setup ────────────────────────────────────────────────
const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: [(process.env.KAFKA_BROKER || 'kafka:9092')],
  retry: { retries: 5, initialRetryTime: 300 }
});

const consumer = kafka.consumer({ groupId: 'notification-service-group' });
const producer  = kafka.producer(); // to publish to notifications-created

function buildMessage(itemName, newStatus) {
  if (newStatus === 'BS')
    return `Running low on ${itemName}. Add it to your shopping list soon!`;
  if (newStatus === 'NA')
    return `You're out of ${itemName}! Purchase it immediately.`;
  return `${itemName} is now available.`;
}

async function startKafkaConsumer() {
  try {
    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({ topic: 'item-status-changed', fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }) => {
        let event;
        try {
          event = JSON.parse(message.value.toString());
        } catch {
          console.warn('[Notification Service] Bad message format, skipping');
          return;
        }

        const { eventId, userId, itemId, itemName, newStatus } = event;

        // Skip if status went back to 'A' (no notification needed)
        if (newStatus === 'A') return;

        // ── Idempotency check ──────────────────────────────────
        try {
          await ProcessedEvent.create({ eventId });
        } catch (dupErr) {
          // Duplicate key error = already processed
          console.log(`[Notification Service] Event ${eventId} already processed, skipping`);
          return;
        }

        // ── Build & persist notification ───────────────────────
        const type    = newStatus === 'NA' ? 'urgent' : 'reminder';
        const message_ = buildMessage(itemName, newStatus);

        let notification;
        try {
          notification = await Notification.create({
            userId, itemId, itemName, message: message_, type, eventId
          });
          console.log(`[Notification Service] Created ${type} notification for user ${userId}`);
        } catch (err) {
          console.error('[Notification Service] Failed to save notification:', err.message);
          return;
        }

        // ── Publish to notifications-created topic ─────────────
        try {
          await producer.send({
            topic: 'notifications-created',
            messages: [{
              key: userId,
              value: JSON.stringify({
                notificationId: notification._id.toString(),
                userId,
                itemId,
                itemName,
                message: message_,
                type,
                timestamp: notification.timestamp
              })
            }]
          });
        } catch (err) {
          console.error('[Notification Service] Failed to publish notifications-created:', err.message);
        }
      }
    });
    console.log('[Notification Service] Kafka consumer running on topic: item-status-changed');
  } catch (err) {
    console.warn('[Notification Service] Kafka not available:', err.message);
  }
}

// ── REST API ───────────────────────────────────────────────────

// GET /api/notifications — list notifications (paginated, filterable by status)
app.get('/api/notifications', verifyToken, async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    const filter = { userId: req.user._id };
    if (status && ['UNREAD', 'READ'].includes(status)) filter.status = status;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ timestamp: -1 })
        .skip(Number(skip))
        .limit(Number(limit)),
      Notification.countDocuments(filter)
    ]);
    res.json({ notifications, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/notifications/count — unread count badge
app.get('/api/notifications/count', verifyToken, async (req, res) => {
  try {
    const unread = await Notification.countDocuments({ userId: req.user._id, status: 'UNREAD' });
    res.json({ unread });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/notifications/:id/read — mark single notification as READ
app.put('/api/notifications/:id/read', verifyToken, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status: 'READ' },
      { new: true }
    );
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    res.json(notif);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/notifications/read-all — mark all notifications as READ
app.put('/api/notifications/read-all', verifyToken, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, status: 'UNREAD' },
      { status: 'READ' }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/notifications/:id — delete a notification
app.delete('/api/notifications/:id', verifyToken, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));

// ── Start ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 5128;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/notifications_db';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('[Notification Service] MongoDB connected');
    startKafkaConsumer();
  })
  .catch(err => console.error('[Notification Service] MongoDB error:', err));

app.listen(PORT, () => console.log(`[Notification Service] Running on port ${PORT}`));

process.on('SIGTERM', async () => {
  await consumer.disconnect();
  await producer.disconnect();
  process.exit(0);
});

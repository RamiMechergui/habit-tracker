const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { Kafka } = require('kafkajs');
const webpush = require('web-push');
const Notification = require('./models/Notification');
const ProcessedEvent = require('./models/ProcessedEvent');
const PushSubscription = require('./models/PushSubscription');

// ── Web Push Setup ─────────────────────────────────────────────
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'BCgZJNOei3SV_w0HlSfIU19B14iNQCN468a7deREHBZCNV7jbBwms6JJuIBF8SSTXZoh7hZFUBqDMfyZKdvWSgE';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'NFgyHMzWbXN2SAPCKzgqQTOMJ3LD6TReyUKLdYy59oM';

try {
  webpush.setVapidDetails('mailto:admin@evolvia.app', publicVapidKey, privateVapidKey);
} catch (err) {
  console.error('[Notification Service] Web Push VAPID setup failed:', err.message);
}

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
  retry: { retries: 2, initialRetryTime: 300 } // Reduced retries for faster failure
});

let consumer = null;
let producer = null;

function buildMessage(itemName, newStatus) {
  if (newStatus === 'BS')
    return `Running low on ${itemName}. Add it to your shopping list soon!`;
  if (newStatus === 'NA')
    return `You're out of ${itemName}! Purchase it immediately.`;
  return `${itemName} is now available.`;
}

const DELIVERY_SERVICE_URL = process.env.DELIVERY_SERVICE_URL || 'http://delivery:5129';

async function processItemStatusEvent(event) {
  const { eventId, userId, itemId, itemName, newStatus } = event;
  if (newStatus === 'A') return;

  try {
    await ProcessedEvent.create({ eventId });
  } catch (dupErr) {
    return;
  }

  const type = newStatus === 'NA' ? 'urgent' : 'reminder';
  const message_ = buildMessage(itemName, newStatus);

  try {
    const notification = await Notification.create({
      userId, itemId, itemName, message: message_, type, eventId
    });

    const payload = {
      notificationId: notification._id.toString(),
      userId,
      itemId,
      itemName,
      message: message_,
      type,
      timestamp: notification.timestamp
    };

    // Trigger Web Push
    try {
      const subscriptions = await PushSubscription.find({ userId });
      for (const sub of subscriptions) {
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify({ title: 'Inventory Alert', body: message_, url: '/essentials' })
        ).catch(async err => {
          if (err.statusCode === 410) await PushSubscription.deleteOne({ _id: sub._id });
        });
      }
    } catch (pushErr) {}

    // Try Kafka
    let kafkaSuccess = false;
    if (producer) {
      try {
        await producer.send({
          topic: 'notifications-created',
          messages: [{ key: userId, value: JSON.stringify(payload) }]
        });
        kafkaSuccess = true;
      } catch (err) {
        console.warn('[Notification Service] Kafka publish failed');
      }
    }

    if (!kafkaSuccess) {
      const url = new URL(`${DELIVERY_SERVICE_URL}/api/delivery/webhook`);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };
      const req = http.request(options);
      req.on('error', () => {});
      req.write(JSON.stringify(payload));
      req.end();
    }
  } catch (err) {}
}

async function processTaskNotification(event) {
  const { userId, taskId, title, time, type } = event;
  const message_ = `Reminder: Task "${title}" is scheduled at ${time}.`;

  try {
    const notification = await Notification.create({
      userId, itemId: taskId, itemName: title, message: message_, type: type || 'task-reminder', eventId: `task_${taskId}_${Date.now()}`
    });

    const payload = {
      notificationId: notification._id.toString(),
      userId,
      itemId: taskId,
      itemName: title,
      message: message_,
      type: type || 'task-reminder',
      timestamp: notification.timestamp
    };

    // Web Push
    try {
      const subscriptions = await PushSubscription.find({ userId });
      for (const sub of subscriptions) {
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify({ title: 'Task Reminder', body: message_, url: '/tasks', taskId })
        ).catch(async err => {
          if (err.statusCode === 410) await PushSubscription.deleteOne({ _id: sub._id });
        });
      }
    } catch (pushErr) {}

    let kafkaSuccess = false;
    if (producer) {
      try {
        await producer.send({
          topic: 'notifications-created',
          messages: [{ key: userId, value: JSON.stringify(payload) }]
        });
        kafkaSuccess = true;
      } catch (err) {}
    }

    if (!kafkaSuccess) {
      const url = new URL(`${DELIVERY_SERVICE_URL}/api/delivery/webhook`);
      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      req.on('error', () => {});
      req.write(JSON.stringify(payload));
      req.end();
    }
  } catch (err) {}
}

async function startKafkaConsumer() {
  try {
    producer = kafka.producer();
    await producer.connect();
    
    consumer = kafka.consumer({ groupId: 'notification-service-group' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'item-status-changed', fromBeginning: false });
    await consumer.subscribe({ topic: 'task-notifications', fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const event = JSON.parse(message.value.toString());
          if (topic === 'item-status-changed') await processItemStatusEvent(event);
          else if (topic === 'task-notifications') await processTaskNotification(event);
        } catch (err) {}
      }
    });
    console.log('[Notification Service] Kafka initialized');
  } catch (err) {
    console.warn('[Notification Service] Kafka failed:', err.message);
  }
}

// ── REST API ───────────────────────────────────────────────────

app.get('/api/notifications/vapidPublicKey', (req, res) => {
  res.json({ publicKey: publicVapidKey });
});

app.post('/api/notifications/subscribe', verifyToken, async (req, res) => {
  try {
    const subscription = req.body;
    await PushSubscription.findOneAndUpdate(
      { userId: req.user._id, endpoint: subscription.endpoint },
      { userId: req.user._id, ...subscription },
      { upsert: true, new: true }
    );
    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const TASKS_SERVICE_URL = process.env.TASKS_SERVICE_URL || 'http://tasks-service:5131';

app.post('/api/notifications/action', verifyToken, async (req, res) => {
  try {
    const { taskId, action } = req.body;
    const url = new URL(`${TASKS_SERVICE_URL}/api/tasks/action`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.cookies.habitToken || req.headers.authorization?.split(' ')[1]}`
      }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', chunk => data += chunk);
      proxyRes.on('end', () => {
        try {
          res.status(proxyRes.statusCode).json(data ? JSON.parse(data) : {});
        } catch (e) {
          res.status(proxyRes.statusCode).json({ message: 'Invalid JSON', raw: data });
        }
      });
    });

    proxyReq.on('error', (err) => {
      res.status(500).json({ message: 'Proxy error' });
    });

    proxyReq.write(JSON.stringify({ taskId, action }));
    proxyReq.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/notifications', verifyToken, async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    const filter = { userId: req.user._id };
    if (status && ['UNREAD', 'READ'].includes(status)) filter.status = status;

    const [notifs, total] = await Promise.all([
      Notification.find(filter).sort({ timestamp: -1 }).skip(Number(skip)).limit(Number(limit)),
      Notification.countDocuments(filter)
    ]);
    res.json({ notifications: notifs, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/notifications/count', verifyToken, async (req, res) => {
  try {
    const unread = await Notification.countDocuments({ userId: req.user._id, status: 'UNREAD' });
    res.json({ unread });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/notifications/:id/read', verifyToken, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { status: 'READ' }, { new: true });
    if (!notif) return res.status(404).json({ message: 'Not found' });
    res.json(notif);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/notifications/read-all', verifyToken, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, status: 'UNREAD' }, { status: 'READ' });
    res.json({ message: 'Done' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/notifications/webhook', async (req, res) => {
  try {
    await processItemStatusEvent(req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/notifications/:id', verifyToken, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Start ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 5128;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/notifications_db';

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Notification Service] Bound to port ${PORT}`);
  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log('[Notification Service] DB Connected');
      startKafkaConsumer();
    })
    .catch(err => console.error('[Notification Service] DB Error:', err.message));
});

process.on('SIGTERM', async () => {
  if (consumer) await consumer.disconnect().catch(() => {});
  if (producer) await producer.disconnect().catch(() => {});
  process.exit(0);
});

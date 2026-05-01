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
mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/habittracker')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Routes
const authRoutes = require('./routes/auth');
const logRoutes = require('./routes/logs');
const userRoutes = require('./routes/user');
const essentialsRoutes = require('./routes/essentials');
const notificationsRoutes = require('./routes/notifications');

app.use('/api/auth', authRoutes);
app.use('/api/daily', logRoutes);
app.use('/api/user', userRoutes);
app.use('/api/essentials', essentialsRoutes);
app.use('/api/notifications', notificationsRoutes);

// Aliases for monolithic compatibility with microservices frontend
app.use('/api/currentbook', userRoutes);
app.use('/api/archives', userRoutes);
app.use('/api/settings', userRoutes);
app.use('/api/categories', userRoutes);
app.use('/api/avatar', userRoutes);

// SSE delivery stream — not available in monolithic mode; return graceful 503
// so the frontend EventSource fails fast rather than hanging indefinitely
app.get('/api/delivery/stream', (_req, res) => {
  res.status(503).json({
    message: 'Delivery service not available in monolithic mode. Real-time push is disabled.'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

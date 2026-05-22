const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI ||
  (process.env.MONGOHOST ? `mongodb://${process.env.MONGOUSER}:${process.env.MONGOPASSWORD}@${process.env.MONGOHOST}:${process.env.MONGOPORT}/auth_db?authSource=admin` : 'mongodb://mongo:27017/auth_db');

mongoose.connect(MONGO_URI)
  .then(() => console.log('Auth Service: MongoDB connected'))
  .catch(err => console.error(err));

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

app.listen(PORT, () => console.log(`Auth Service running on port ${PORT}`));
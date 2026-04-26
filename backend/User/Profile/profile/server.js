const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Profile = require('./models/Profile');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

const uploadDir = '/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user_${req.user?._id || 'unknown'}${ext}`);
  }
});

const upload = multer({ storage });

const verifyToken = async (req, res, next) => {
  let token;
  if (req.cookies.habitToken) {
    token = req.cookies.habitToken;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  try {
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://verify:5104';
    const response = await axios.get(`${authServiceUrl}/api/verify`, {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: true
    });
    req.user = { _id: response.data.userId };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

app.get('/api/profile/me', verifyToken, async (req, res) => {
  try {
    let profile = await Profile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = await Profile.create({ userId: req.user._id });
    }
    res.json({
      profilePicture: profile.profilePicture,
      expenseCategories: profile.expenseCategories,
      theme: profile.theme
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/profile/picture', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filename = req.file.filename;
    const picturePath = `/uploads/${filename}`;

    await Profile.findOneAndUpdate(
      { userId: req.user._id },
      { profilePicture: picturePath },
      { upsert: true, new: true }
    );

    res.json({ profilePicture: picturePath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Upload failed' });
  }
});

app.put('/api/profile/theme', verifyToken, async (req, res) => {
  try {
    const { theme } = req.body;
    const profile = await Profile.findOneAndUpdate(
      { userId: req.user._id },
      { theme },
      { upsert: true, new: true }
    );
    res.json({ theme: profile.theme });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/profile/categories', verifyToken, async (req, res) => {
  try {
    let profile = await Profile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = await Profile.create({ userId: req.user._id });
    }
    res.json({ expenseCategories: profile.expenseCategories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/profile/categories', verifyToken, async (req, res) => {
  try {
    const { category } = req.body;
    
    if (!category || !category.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    let profile = await Profile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = await Profile.create({ userId: req.user._id });
    }
    
    if (profile.expenseCategories.includes(category.trim())) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    profile.expenseCategories.push(category.trim());
    await profile.save();

    res.json({ expenseCategories: profile.expenseCategories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/profile/categories/:category', verifyToken, async (req, res) => {
  try {
    const { category } = req.params;
    let profile = await Profile.findOne({ userId: req.user._id });
    
    if (profile) {
      profile.expenseCategories = profile.expenseCategories.filter(c => c !== decodeURIComponent(category));
      await profile.save();
    }

    res.json({ expenseCategories: profile?.expenseCategories || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/health', (req, res) => res.status(200).send('OK'));

const PORT = process.env.PORT || 5112;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/profile_db';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Profile Service: MongoDB connected'))
  .catch(err => console.error(err));

app.listen(PORT, () => console.log(`Profile Service running on port ${PORT}`));
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const Avatar = require('./models/Avatar');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));

// ─── Multer: in-memory storage (no disk required) ────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

// ─── Swagger ──────────────────────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Avatar Service API',
      version: '2.0.0',
      description: 'User avatar storage service (base64 / MongoDB)',
      contact: { name: 'API Support', email: 'support@evolvia.com' },
    },
    servers: [{ url: 'http://localhost:5111' }],
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'habitToken' },
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  },
  apis: ['./server.js'],
};
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// ─── Auth middleware ──────────────────────────────────────────────────────────
const verifyToken = (req, res, next) => {
  let token;
  if (req.cookies.habitToken) token = req.cookies.habitToken;
  else if (req.headers.authorization?.startsWith('Bearer '))
    token = req.headers.authorization.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Not authorized' });

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_prod'
    );
    req.user = { _id: decoded.id };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/avatar:
 *   get:
 *     summary: Get the authenticated user's avatar
 *     tags: [Avatar]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200:
 *         description: Returns the profilePicture data-URL (or empty string)
 */
app.get('/api/avatar', verifyToken, async (req, res) => {
  try {
    let avatar = await Avatar.findOne({ userId: req.user._id });
    if (!avatar) avatar = await Avatar.create({ userId: req.user._id });
    res.json({ profilePicture: avatar.profilePicture });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/avatar:
 *   post:
 *     summary: Upload / replace the authenticated user's avatar
 *     tags: [Avatar]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar stored — returns the profilePicture data-URL
 *       400:
 *         description: No file uploaded or invalid file type
 *       413:
 *         description: File exceeds the 5 MB limit
 */
app.post('/api/avatar', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Convert buffer → base64 data-URL and store in MongoDB
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    await Avatar.findOneAndUpdate(
      { userId: req.user._id },
      { profilePicture: dataUrl },
      { upsert: true, new: true }
    );

    res.json({ profilePicture: dataUrl });
  } catch (error) {
    if (error.code === 'LIMIT_FILE_SIZE')
      return res.status(413).json({ message: 'Image must be under 5 MB' });
    res.status(500).json({ message: 'Upload failed' });
  }
});

/**
 * @swagger
 * /api/avatar:
 *   delete:
 *     summary: Remove the authenticated user's avatar
 *     tags: [Avatar]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200:
 *         description: Avatar removed
 */
app.delete('/api/avatar', verifyToken, async (req, res) => {
  try {
    await Avatar.findOneAndUpdate(
      { userId: req.user._id },
      { profilePicture: '' },
      { upsert: true }
    );
    res.json({ message: 'Avatar removed', profilePicture: '' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Multer error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE')
      return res.status(413).json({ message: 'Image must be under 5 MB' });
    return res.status(400).json({ message: err.message });
  }
  if (err) return res.status(400).json({ message: err.message });
  next();
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5111;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/avatar_db';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('Avatar Service: MongoDB connected'))
  .catch((err) => console.error('Avatar Service: MongoDB connection error', err));

app.listen(PORT, () => console.log(`Avatar Service running on port ${PORT}`));
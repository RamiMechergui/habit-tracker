const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const Avatar = require('./models/Avatar');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));

const uploadDir = '/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `user_${req.user?._id || 'unknown'}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'Avatar Service API', version: '1.0.0', description: 'User avatar service', contact: { name: 'API Support', email: 'support@evolvia.com' } },
    servers: [{ url: 'http://localhost:5111' }],
    components: { securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'habitToken' }, bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    security: [{ cookieAuth: [] }, { bearerAuth: [] }]
  },
  apis: ['./server.js']
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

const verifyToken = (req, res, next) => {
  let token;
  if (req.cookies.habitToken) token = req.cookies.habitToken;
  else if (req.headers.authorization?.startsWith('Bearer')) token = req.headers.authorization.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Not authorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_prod');
    req.user = { _id: decoded.id };
    next();
  } catch (error) { res.status(401).json({ message: 'Invalid token' }); }
};

/**
 * @swagger
 * /api/avatar:
 *   get:
 *     summary: Get avatar
 *     tags: [Profile]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200:
 *         description: Avatar retrieved
 */
app.get('/api/avatar', verifyToken, async (req, res) => {
  try {
    let avatar = await Avatar.findOne({ userId: req.user._id });
    if (!avatar) { avatar = await Avatar.create({ userId: req.user._id }); }
    res.json({ profilePicture: avatar.profilePicture });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

/**
 * @swagger
 * /api/avatar:
 *   post:
 *     summary: Upload avatar
 *     tags: [Profile]
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
 *         description: Avatar uploaded
 */
app.post('/api/avatar', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const picturePath = `/uploads/${req.file.filename}`;
    await Avatar.findOneAndUpdate({ userId: req.user._id }, { profilePicture: picturePath }, { upsert: true });
    res.json({ profilePicture: picturePath });
  } catch (error) { res.status(500).json({ message: 'Upload failed' }); }
});

const PORT = process.env.PORT || 5111;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/avatar_db';

mongoose.connect(MONGO_URI).then(() => console.log('Avatar Service: MongoDB connected')).catch(err => console.error(err));
app.listen(PORT, () => console.log(`Avatar Service running on port ${PORT}`));
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const Settings = require('./models/Settings');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'Settings Service API', version: '1.0.0', description: 'User settings service', contact: { name: 'API Support', email: 'support@evolvia.com' } },
    servers: [{ url: 'http://localhost:5109' }],
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
 * /api/settings:
 *   get:
 *     summary: Get user settings
 *     tags: [Profile]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200:
 *         description: Settings retrieved
 */
app.get('/api/settings', verifyToken, async (req, res) => {
  try {
    let settings = await Settings.findOne({ userId: req.user._id });
    if (!settings) { settings = await Settings.create({ userId: req.user._id }); }
    res.json({ firstName: settings.firstName, lastName: settings.lastName, theme: settings.theme });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// Alias: GET /api/user/me — same data, used by the frontend refreshFromServer()
app.get('/api/user/me', verifyToken, async (req, res) => {
  try {
    let settings = await Settings.findOne({ userId: req.user._id });
    if (!settings) { settings = await Settings.create({ userId: req.user._id }); }
    res.json({
      firstName:      settings.firstName      || '',
      lastName:       settings.lastName       || '',
      profilePicture: settings.profilePicture || null,
      email:          settings.email          || ''
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
});


/**
 * @swagger
 * /api/settings:
 *   put:
 *     summary: Update user settings
 *     tags: [Profile]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               theme: { type: string }
 *     responses:
 *       200:
 *         description: Settings updated
 */
app.put('/api/settings', verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, theme } = req.body;
    let settings = await Settings.findOneAndUpdate(
      { userId: req.user._id },
      { firstName, lastName, theme },
      { upsert: true, new: true }
    );
    res.json({ firstName: settings.firstName, lastName: settings.lastName, theme: settings.theme });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

const PORT = process.env.PORT || 5109;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/settings_db';

mongoose.connect(MONGO_URI).then(() => console.log('Settings Service: MongoDB connected')).catch(err => console.error(err));
app.listen(PORT, () => console.log(`Settings Service running on port ${PORT}`));
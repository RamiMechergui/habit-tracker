const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Verify Service API',
      version: '1.0.0',
      description: 'Token verification service',
      contact: { name: 'API Support', email: 'support@evolvia.com' }
    },
    servers: [{ url: 'http://localhost:5104' }],
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'habitToken' },
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    },
    security: [{ cookieAuth: [] }, { bearerAuth: [] }]
  },
  apis: ['./server.js']
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// ── User model (same schema as the login service) ─────────────────────────
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  email:  { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, default: '' },
  lastName:  { type: String, default: '' },
  profilePicture: { type: String, default: null }
}, { timestamps: true });

// Avoid OverwriteModelError if model was already registered
const User = mongoose.models.User || mongoose.model('User', userSchema);

/**
 * @swagger
 * /api/verify:
 *   get:
 *     summary: Verify authentication token
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid — returns userId, email, firstName, lastName, profilePicture
 *       401:
 *         description: Invalid or missing token
 */
app.get('/api/verify', async (req, res) => {
  let token;
  if (req.cookies.habitToken) token = req.cookies.habitToken;
  else if (req.headers.authorization?.startsWith('Bearer')) token = req.headers.authorization.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Not authorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_prod');

    // Look up the user in DB so we can return firstName, lastName, profilePicture
    let firstName = '';
    let lastName  = '';
    let profilePicture = null;
    let email = decoded.email || '';

    if (mongoose.connection.readyState === 1) {
      try {
        // userId in the JWT is stored as decoded.id (set at login with `{ id: user.userId }`)
        const user = await User.findOne({ userId: decoded.id }).select('-password');
        if (user) {
          firstName      = user.firstName      || '';
          lastName       = user.lastName       || '';
          profilePicture = user.profilePicture || null;
          email          = user.email;
        }
      } catch (dbErr) {
        // DB error — return what we have from the token (degrade gracefully)
        console.warn('[Verify] DB lookup failed, falling back to token claims:', dbErr.message);
      }
    }

    res.json({
      userId: decoded.id,
      email,
      firstName,
      lastName,
      profilePicture,
      verified: true
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

app.get('/health', (req, res) => res.status(200).send('OK'));

const PORT = process.env.PORT || 5104;
const MONGO_URI = process.env.MONGO_URI || (process.env.NODE_ENV === 'production' ? '' : 'mongodb://mongo:27017/auth_db');

// Connect to MongoDB (same database as the login service)
if (MONGO_URI) {
  mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 })
    .then(() => console.log('Verify Service: MongoDB connected'))
    .catch(err => console.error('Verify Service: MongoDB connection failed:', err.message));
} else {
  console.warn('Verify Service: MONGO_URI not set — will return token-only data (no name/avatar)');
}

app.listen(PORT, () => console.log(`Verify Service running on port ${PORT}`));
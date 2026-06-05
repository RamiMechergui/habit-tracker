const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
mongoose.set('bufferCommands', false);
const User = require('./models/User');

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
      title: 'Register Service API',
      version: '1.0.0',
      description: 'User registration service',
      contact: { name: 'API Support', email: 'support@evolvia.com' }
    },
    servers: [{ url: 'http://localhost:5102' }],
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'habitToken' }
      }
    },
    security: [{ cookieAuth: [] }]
  },
  apis: ['./server.js']
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * /api/register:
 *   post:
 *     summary: Register new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - confirmPassword
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Validation error
 */
app.post('/api/register', async (req, res) => {
  const { email, password, confirmPassword, firstName = '', lastName = '' } = req.body;
  if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match' });
  
  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const userId = 'user_' + Date.now();
    const user = await User.create({ userId, email, password, firstName, lastName });
    
    const token = jwt.sign({ id: user.userId, email: user.email }, process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_prod', { expiresIn: '30d' });
    res.cookie('habitToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    
    res.status(201).json({ 
      userId: user.userId, 
      email: user.email, 
      firstName: user.firstName,
      lastName: user.lastName,
      token
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    service: 'register',
    mongo: connected ? 'connected' : 'disconnected'
  });
});

const PORT = process.env.PORT || 5102;
const MONGO_URI = process.env.MONGO_URI || (process.env.NODE_ENV === 'production' ? '' : 'mongodb://mongo:27017/auth_db');

const maskedURI = MONGO_URI ? MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//xxxx:xxxx@') : 'UNDEFINED';
console.log(`[Register Service] Attempting connection to MongoDB at: ${maskedURI}`);

// Explicit connection event listeners for logging detailed state
mongoose.connection.on('connecting', () => {
  console.log('[Register Service: Mongoose] Connecting to MongoDB...');
});

mongoose.connection.on('connected', () => {
  console.log('[Register Service: Mongoose] Connected successfully to database:', mongoose.connection.name);
});

mongoose.connection.on('error', (err) => {
  console.error('[Register Service: Mongoose] Connection error encountered:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[Register Service: Mongoose] Disconnected from MongoDB');
});

async function start() {
  if (!MONGO_URI) {
    throw new Error('Register Service: MONGO_URI is not set. Add Railway MongoDB variables or a MONGO_URL reference.');
  }

  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000
  });
  console.log('Register Service: Initial connection call completed');

  app.listen(PORT, () => console.log(`Register Service running on port ${PORT}`));
}

start().catch(err => {
  console.error('Register Service: Startup failed:', err);
  process.exit(1);
});

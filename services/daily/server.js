const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const DailyLog = require('./models/DailyLog');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Daily Service API',
      version: '1.0.0',
      description: 'Daily habit logs service',
      contact: { name: 'API Support', email: 'support@evolvia.com' }
    },
    servers: [{ url: 'http://localhost:5105' }],
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

/**
 * @swagger
 * /api/daily:
 *   get:
 *     summary: Get all daily logs
 *     tags: [Daily]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logs retrieved
 */
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

app.get('/api/daily', verifyToken, async (req, res) => {
  try {
    const logs = await DailyLog.find({ userId: req.user._id });
    const logsObj = {};
    logs.forEach(l => { logsObj[l.date] = l.data; });
    res.json(logsObj);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

/**
 * @swagger
 * /api/daily/{date}:
 *   post:
 *     summary: Save daily log
 *     tags: [Daily]
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Log saved
 */
app.post('/api/daily/:date', verifyToken, async (req, res) => {
  try {
    const { date } = req.params;
    const data = req.body;
    let log = await DailyLog.findOne({ userId: req.user._id, date });
    if (log) { log.data = data; await log.save(); }
    else { log = await DailyLog.create({ userId: req.user._id, date, data }); }

    // COMMUNICATION: Notify Analytics Service
    try {
      const analyticsUrl = process.env.ANALYTICS_SERVICE_URL || 'http://analytics:5113';
      await axios.post(`${analyticsUrl}/api/analytics/ingest`, {
        date,
        totalScore: data.totalScore || 0,
        rank: data.rank || 'N/A',
        totalExpenses: data.expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0,
        bookPages: data.book?.pagesRead || 0
      }, { 
        headers: { Authorization: req.headers.authorization },
        withCredentials: true
      });
      console.log(`[COMMUNICATION SUCCESS] Daily -> Analytics for ${date}`);
    } catch (err) {
      console.error(`[COMMUNICATION FAILURE] Daily -> Analytics: ${err.message}`);
    }

    res.json(log.data);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/health', (req, res) => res.status(200).send('OK'));

const PORT = process.env.PORT || 5105;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/daily_db';

mongoose.connect(MONGO_URI).then(() => console.log('Daily Service: MongoDB connected')).catch(err => console.error(err));
app.listen(PORT, () => console.log(`Daily Service running on port ${PORT}`));
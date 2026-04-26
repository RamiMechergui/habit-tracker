const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Scoring Service API',
      version: '1.0.0',
      description: 'Habit scoring calculation service',
      contact: { name: 'API Support', email: 'support@evolvia.com' }
    },
    servers: [{ url: 'http://localhost:5106' }],
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
 * /api/scoring/calculate:
 *   post:
 *     summary: Calculate habit score
 *     tags: [Scoring]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Score calculated
 */
app.post('/api/scoring/calculate', verifyToken, (req, res) => {
  const { data } = req.body;
  
  let mScore = 0;
  if (data.morning?.wakeTime) {
    const time = parseInt(data.morning.wakeTime.replace(':', ''));
    if (time <= 500) mScore += 14;
    else if (time <= 600) mScore += 10;
    else if (time <= 700) mScore += 5;
  }
  if (data.morning?.meditate) mScore += 1;
  if (data.morning?.bed) mScore += 1;
  if (data.morning?.teeth) mScore += 2;
  if (data.morning?.shower) mScore += 10;
  if (data.morning?.gel) mScore += 1;
  if (data.morning?.perfume) mScore += 1;

  let nScore = 0;
  const n = data.night;
  if (n?.gym) nScore += 6;
  if (n?.cleanTable) nScore += 1;
  if (n?.orgTable) nScore += 1;
  if (n?.teeth) nScore += 2;
  if (n?.shave) nScore += 1;
  if (n?.washFace) nScore += 1;
  if (n?.hotShower) nScore += 4;
  if (n?.hygiene) nScore += 2;
  if (n?.fingerNails) nScore += 1;
  if (n?.toeNails) nScore += 1;
  if (n?.wiseSpend) nScore += 1;
  if (n?.saves) nScore += 1;
  if (n?.noSugar) nScore += 8;

  let bScore = 0;
  const b = data.bad;
  if (b?.smoking?.checked) bScore += 12;
  if (b?.sexual?.checked) bScore += 4;
  if (b?.social?.checked) bScore += 2;
  if (b?.phone?.checked) bScore += 8;
  if (b?.coffee?.checked) bScore += 2;
  if (b?.eating?.checked) bScore += 2;

  let bkScore = data.books?.read ? 10 : 0;
  let hScore = data.hustle?.achieved ? 5 : 0;
  let vScore = data.video?.achieved ? 5 : 0;

  let totalScore = Math.max(0, Math.min(100, mScore + nScore + bScore + bkScore + hScore + vScore));
  
  let rank = 'F';
  if (totalScore >= 90) rank = 'S';
  else if (totalScore >= 80) rank = 'A';
  else if (totalScore >= 60) rank = 'B';
  else if (totalScore >= 50) rank = 'C';

  res.json({
    morningScore: mScore,
    nightScore: nScore,
    badScore: bScore,
    bookScore: bkScore,
    hustleScore: hScore,
    videoScore: vScore,
    totalScore,
    rank
  });
});

app.get('/health', (req, res) => res.status(200).send('OK'));

const PORT = process.env.PORT || 5106;
app.listen(PORT, () => console.log(`Scoring Service running on port ${PORT}`));
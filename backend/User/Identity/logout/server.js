const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

/**
 * @swagger
 * /api/logout:
 *   post:
 *     summary: User logout
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logout successful
 */
app.post('/api/logout', (req, res) => {
  res.clearCookie('habitToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ message: 'Logged out successfully' });
});

// Swagger UI (basic setup without jsdoc)
app.get('/api-docs', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Logout Service API</title></head>
    <body>
      <h1>Logout Service API</h1>
      <p>POST /api/logout - Logout user</p>
    </body>
    </html>
  `);
});

app.get('/health', (req, res) => res.status(200).send('OK'));

const PORT = process.env.PORT || 5103;
app.listen(PORT, () => console.log(`Logout Service running on port ${PORT}`));
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));

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

const SERVICES = {
  morning: process.env.MORNING_SERVICE_URL || 'http://morning-habits:5118',
  bad: process.env.BAD_SERVICE_URL || 'http://bad-habits:5119',
  night: process.env.NIGHT_SERVICE_URL || 'http://night-habits:5120',
  weekend: process.env.WEEKEND_SERVICE_URL || 'http://weekend-duties:5121',
  hustle: process.env.HUSTLE_SERVICE_URL || 'http://side-hustle:5122',
  video: process.env.VIDEO_SERVICE_URL || 'http://video-editing:5123',
  books: process.env.BOOK_LOG_SERVICE_URL || 'http://book-reading:5124',
  system: process.env.SYSTEM_SERVICE_URL || 'http://system-check:5125',
  expenses: process.env.EXPENSES_SERVICE_URL || 'http://expenses:5126'
};

app.get('/api/daily', verifyToken, async (req, res) => {
  try {
    const authHeader = req.headers.authorization || `Bearer ${req.cookies.habitToken}`;
    
    const results = await Promise.allSettled(
      Object.entries(SERVICES).map(([key, url]) => {
        const endpoint = key === 'books' ? 'book-log' : key;
        return axios.get(`${url}/api/${endpoint}`, {
          headers: { Authorization: authHeader },
          withCredentials: true
        });
      })
    );

    const logsByDate = {};

    results.forEach((result, i) => {
      const key = Object.keys(SERVICES)[i];
      if (result.status === 'fulfilled') {
        const items = result.value.data;
        items.forEach(item => {
          if (!logsByDate[item.date]) logsByDate[item.date] = {};
          // Map book-log back to 'books' key if needed, or just use the key
          logsByDate[item.date][key] = item;
        });
      }
    });

    res.json(logsByDate);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/daily/:date', verifyToken, async (req, res) => {
  try {
    const { date } = req.params;
    const authHeader = req.headers.authorization || `Bearer ${req.cookies.habitToken}`;

    const results = await Promise.allSettled(
      Object.entries(SERVICES).map(([key, url]) => {
        const endpoint = key === 'books' ? 'book-log' : key;
        return axios.get(`${url}/api/${endpoint}/${date}`, {
          headers: { Authorization: authHeader },
          withCredentials: true
        });
      })
    );

    const fullLog = { date };
    results.forEach((result, i) => {
      const key = Object.keys(SERVICES)[i];
      if (result.status === 'fulfilled') {
        fullLog[key] = result.value.data;
      } else {
        fullLog[key] = {}; 
      }
    });

    res.json(fullLog);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/daily/:date', verifyToken, async (req, res) => {
  try {
    const { date } = req.params;
    const data = req.body;
    const authHeader = req.headers.authorization || `Bearer ${req.cookies.habitToken}`;

    // Split and save to each service
    await Promise.allSettled(
      Object.entries(SERVICES).map(([key, url]) => {
        const endpoint = key === 'books' ? 'book-log' : key;
        const sectionData = data[key] || {};
        return axios.post(`${url}/api/${endpoint}/${date}`, sectionData, {
          headers: { Authorization: authHeader },
          withCredentials: true
        });
      })
    );

    // Notify Analytics
    try {
      const analyticsUrl = process.env.ANALYTICS_SERVICE_URL || 'http://analytics:5113';
      await axios.post(`${analyticsUrl}/api/analytics/ingest`, {
        date,
        totalScore: data.totalScore || 0,
        rank: data.rank || 'N/A',
        totalExpenses: data.expenses?.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) || 0,
        bookPages: data.books?.page || 0
      }, { 
        headers: { Authorization: authHeader },
        withCredentials: true
      });
    } catch (err) {
      console.error(`Aggregator -> Analytics Failure: ${err.message}`);
    }

    res.json(data);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/health', (req, res) => res.status(200).send('OK'));

const PORT = process.env.PORT || 5105;
app.listen(PORT, () => console.log(`Daily Aggregator Service running on port ${PORT}`));
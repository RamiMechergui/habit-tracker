const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

let app;
let logs = {};

beforeAll(() => {
  app = express();
  app.use(express.json());

  const verifyToken = (req, res, next) => {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ message: 'Not authorized' });
    try {
      const decoded = jwt.verify(token, 'supersecretjwtkey_change_me_in_prod');
      req.user = { _id: decoded.id };
      next();
    } catch (error) {
      res.status(401).json({ message: 'Invalid token' });
    }
  };

  app.get('/api/daily', verifyToken, (req, res) => {
    const userLogs = logs[req.user._id] || {};
    res.json(userLogs);
  });

  app.post('/api/daily/:date', verifyToken, (req, res) => {
    const { date } = req.params;
    const data = req.body;
    
    if (!logs[req.user._id]) {
      logs[req.user._id] = {};
    }
    
    logs[req.user._id][date] = data;
    res.json(data);
  });
});

const token = jwt.sign({ id: 'user_daily_test' }, 'supersecretjwtkey_change_me_in_prod');

describe('Daily Logs API', () => {
  beforeEach(() => {
    logs = {};
  });

  it('should get empty logs initially', async () => {
    const res = await request(app)
      .get('/api/daily')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({});
  });

  it('should create a daily log', async () => {
    const logData = {
      morning: { wakeTime: '06:00', meditate: true },
      totalScore: 50,
      rank: 'C'
    };

    const res = await request(app)
      .post('/api/daily/2024-01-15')
      .set('Authorization', `Bearer ${token}`)
      .send(logData)
      .expect(200);

    expect(res.body.totalScore).toBe(50);
  });

  it('should retrieve saved log', async () => {
    const logData = { morning: { wakeTime: '05:00' }, totalScore: 80 };
    
    await request(app)
      .post('/api/daily/2024-01-16')
      .set('Authorization', `Bearer ${token}`)
      .send(logData);

    const res = await request(app)
      .get('/api/daily')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body['2024-01-16']).toBeDefined();
    expect(res.body['2024-01-16'].totalScore).toBe(80);
  });

  it('should update existing log', async () => {
    await request(app)
      .post('/api/daily/2024-01-17')
      .set('Authorization', `Bearer ${token}`)
      .send({ morning: { wakeTime: '07:00' }, totalScore: 40 });

    const res = await request(app)
      .post('/api/daily/2024-01-17')
      .set('Authorization', `Bearer ${token}`)
      .send({ morning: { wakeTime: '06:00' }, totalScore: 55 })
      .expect(200);

    expect(res.body.totalScore).toBe(55);
  });

  it('should reject unauthorized access', async () => {
    const res = await request(app)
      .get('/api/daily')
      .expect(401);
  });
});
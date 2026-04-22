const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

let app;
let settings = {};

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

  app.get('/api/settings', verifyToken, (req, res) => {
    const userSettings = settings[req.user._id] || { firstName: '', lastName: '', theme: 'dark' };
    res.json(userSettings);
  });

  app.put('/api/settings', verifyToken, (req, res) => {
    const { firstName, lastName, theme } = req.body;
    settings[req.user._id] = { firstName, lastName, theme };
    res.json(settings[req.user._id]);
  });
});

const token = jwt.sign({ id: 'user_settings_test' }, 'supersecretjwtkey_change_me_in_prod');

describe('Settings API', () => {
  beforeEach(() => {
    settings = {};
  });

  it('should get default settings', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.theme).toBe('dark');
    expect(res.body.firstName).toBe('');
  });

  it('should update settings', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'John', lastName: 'Doe', theme: 'light' })
      .expect(200);

    expect(res.body.firstName).toBe('John');
    expect(res.body.lastName).toBe('Doe');
    expect(res.body.theme).toBe('light');
  });

  it('should update theme only', async () => {
    await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'John' });

    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'light' })
      .expect(200);

    expect(res.body.theme).toBe('light');
    expect(res.body.firstName).toBe('John');
  });

  it('should reject unauthorized access', async () => {
    const res = await request(app)
      .get('/api/settings')
      .expect(401);
  });
});
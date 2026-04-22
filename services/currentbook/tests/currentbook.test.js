const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

let app;
let books = {};

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

  app.get('/api/currentbook', verifyToken, (req, res) => {
    const book = books[req.user._id] || { bookName: '', targetPages: 0, startDate: '', isActive: false };
    res.json(book);
  });

  app.post('/api/currentbook', verifyToken, (req, res) => {
    const { bookName, targetPages } = req.body;
    if (!bookName?.trim()) return res.status(400).json({ message: 'Book name is required' });
    if (!targetPages || targetPages <= 0) return res.status(400).json({ message: 'Target pages must be greater than 0' });

    books[req.user._id] = {
      bookName: bookName.trim(),
      targetPages: parseInt(targetPages),
      startDate: new Date().toISOString().split('T')[0],
      isActive: true
    };
    res.json(books[req.user._id]);
  });

  app.put('/api/currentbook', verifyToken, (req, res) => {
    const { isActive } = req.body;
    if (!books[req.user._id] || !books[req.user._id].bookName) {
      return res.status(400).json({ message: 'No active book' });
    }

    books[req.user._id].isActive = isActive !== undefined ? isActive : false;
    res.json(books[req.user._id]);
  });
});

const token = jwt.sign({ id: 'user_book_test' }, 'supersecretjwtkey_change_me_in_prod');

describe('Current Book API', () => {
  beforeEach(() => {
    books = {};
  });

  it('should get empty book initially', async () => {
    const res = await request(app)
      .get('/api/currentbook')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.bookName).toBe('');
  });

  it('should set a new book', async () => {
    const res = await request(app)
      .post('/api/currentbook')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookName: 'Atomic Habits', targetPages: 200 })
      .expect(200);

    expect(res.body.bookName).toBe('Atomic Habits');
    expect(res.body.targetPages).toBe(200);
    expect(res.body.isActive).toBe(true);
  });

  it('should reject empty book name', async () => {
    const res = await request(app)
      .post('/api/currentbook')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookName: '', targetPages: 100 })
      .expect(400);

    expect(res.body.message).toBe('Book name is required');
  });

  it('should reject invalid pages', async () => {
    const res = await request(app)
      .post('/api/currentbook')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookName: 'Test Book', targetPages: 0 })
      .expect(400);

    expect(res.body.message).toBe('Target pages must be greater than 0');
  });

  it('should update book status', async () => {
    await request(app)
      .post('/api/currentbook')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookName: 'Test Book', targetPages: 100 });

    const res = await request(app)
      .put('/api/currentbook')
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
      .expect(200);

    expect(res.body.isActive).toBe(false);
  });

  it('should reject when no book exists', async () => {
    const res = await request(app)
      .put('/api/currentbook')
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
      .expect(400);

    expect(res.body.message).toBe('No active book');
  });
});
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

let app;
let categories = {};

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

  app.get('/api/categories', verifyToken, (req, res) => {
    const userCategories = categories[req.user._id] || {
      expenseCategories: ['Transportation', 'Food & Dining', 'Clothes', 'Tech & Electronics', 'Groceries', 'Entertainment', 'Health', 'Other']
    };
    res.json(userCategories);
  });

  app.post('/api/categories', verifyToken, (req, res) => {
    const { category } = req.body;
    if (!category?.trim()) return res.status(400).json({ message: 'Category name is required' });

    if (!categories[req.user._id]) {
      categories[req.user._id] = { expenseCategories: ['Other'] };
    }

    if (categories[req.user._id].expenseCategories.includes(category.trim())) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    categories[req.user._id].expenseCategories.push(category.trim());
    res.json({ expenseCategories: categories[req.user._id].expenseCategories });
  });

  app.delete('/api/categories/:category', verifyToken, (req, res) => {
    const { category } = req.params;
    if (categories[req.user._id]) {
      categories[req.user._id].expenseCategories = categories[req.user._id].expenseCategories.filter(c => c !== decodeURIComponent(category));
    }
    res.json({ expenseCategories: categories[req.user._id]?.expenseCategories || [] });
  });
});

const token = jwt.sign({ id: 'test_user_123' }, 'supersecretjwtkey_change_me_in_prod');

describe('Categories API', () => {
  beforeEach(() => {
    categories = {};
  });

  it('should get default categories', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.expenseCategories).toBeDefined();
    expect(res.body.expenseCategories.length).toBeGreaterThan(0);
  });

  it('should add a new category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Software' })
      .expect(200);

    expect(res.body.expenseCategories).toContain('Software');
  });

  it('should reject duplicate category', async () => {
    await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Software' });

    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Software' })
      .expect(400);

    expect(res.body.message).toBe('Category already exists');
  });

  it('should reject empty category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: '' })
      .expect(400);

    expect(res.body.message).toBe('Category name is required');
  });

  it('should delete a category', async () => {
    await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'ToDelete' });

    const res = await request(app)
      .delete('/api/categories/ToDelete')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.expenseCategories).not.toContain('ToDelete');
  });
});
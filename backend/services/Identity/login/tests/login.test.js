const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

let mongoServer;
let app;
let User;
let token;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' }
  });
  
  userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  });
  
  userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
  };
  
  User = mongoose.model('User', userSchema);

  app = express();
  app.use(express.json());
  app.use(cookieParser());
  
  app.use((req, res, next) => {
    req.appLocals = { User };
    next();
  });

  const generateToken = (id) => jwt.sign({ id }, 'supersecretjwtkey_change_me_in_prod', { expiresIn: '30d' });

  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const User = req.appLocals.User;
    
    try {
      const user = await User.findOne({ email });
      if (user && (await user.matchPassword(password))) {
        const token = generateToken(user.userId);
        res.cookie('habitToken', token, {
          httpOnly: true,
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60 * 1000
        });
        res.json({ userId: user.userId, email: user.email, firstName: user.firstName, lastName: user.lastName });
      } else {
        res.status(401).json({ message: 'Invalid email or password' });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  const hashedPassword = await bcrypt.hash('testpassword123', 10);
  await User.create({
    userId: 'user_test123',
    email: 'test@example.com',
    password: hashedPassword,
    firstName: 'Test',
    lastName: 'User'
  });
});

afterEach(async () => {
  await User.deleteMany({});
});

describe('POST /api/login', () => {
  it('should login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'test@example.com', password: 'testpassword123' })
      .expect(200);
    
    expect(res.body.userId).toBe('user_test123');
    expect(res.body.email).toBe('test@example.com');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should reject invalid password', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' })
      .expect(401);
    
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('should reject non-existent user', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'nonexistent@example.com', password: 'password' })
      .expect(401);
    
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('should reject empty email', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: '', password: 'testpassword123' })
      .expect(500);
  });
});
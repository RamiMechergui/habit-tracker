const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_prod', {
    expiresIn: '30d',
  });
};

router.post('/register', async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({ firstName: firstName || '', lastName: lastName || '', email, password });
    if (user) {
      const token = generateToken(user._id);
      
      res.cookie('habitToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      res.status(201).json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        expenseCategories: user.expenseCategories
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (user && (await user.matchPassword(password))) {
      const token = generateToken(user._id);
      
      res.cookie('habitToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      res.json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        expenseCategories: user.expenseCategories
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('habitToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;

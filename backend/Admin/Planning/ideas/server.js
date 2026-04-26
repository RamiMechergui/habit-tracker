const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ideas_db';
mongoose.connect(MONGO_URI).then(() => console.log('Ideas DB Connected'));

const IdeaSchema = new mongoose.Schema({
  title: String,
  description: String,
  status: { type: String, enum: ['Proposed', 'In Progress', 'Completed', 'On Hold'], default: 'Proposed' },
  progress: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Idea = mongoose.model('Idea', IdeaSchema);

const verifyAdminToken = (req, res, next) => {
  let token;
  if (req.cookies.habitToken) token = req.cookies.habitToken;
  else if (req.headers.authorization?.startsWith('Bearer')) token = req.headers.authorization.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Not authorized' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_prod');
    // Assuming admin role or just verifying for now as it's an admin-only service
    req.user = { _id: decoded.id };
    next();
  } catch (error) { res.status(401).json({ message: 'Invalid token' }); }
};

app.get('/api/ideas', verifyAdminToken, async (req, res) => {
  try {
    const ideas = await Idea.find().sort({ createdAt: -1 });
    res.json(ideas);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/ideas', verifyAdminToken, async (req, res) => {
  try {
    const idea = new Idea(req.body);
    await idea.save();
    res.status(201).json(idea);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

app.put('/api/ideas/:id', verifyAdminToken, async (req, res) => {
  try {
    const idea = await Idea.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: Date.now() }, { new: true });
    res.json(idea);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

app.delete('/api/ideas/:id', verifyAdminToken, async (req, res) => {
  try {
    await Idea.findByIdAndDelete(req.params.id);
    res.json({ message: 'Idea deleted' });
  } catch (error) { res.status(400).json({ message: error.message }); }
});

const PORT = process.env.PORT || 5128;
app.listen(PORT, () => console.log(`Ideas Planning Service running on port ${PORT}`));

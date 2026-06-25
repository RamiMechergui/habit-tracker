const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getAllLogs, upsertLog } = require('../db/logs');

// All routes require auth
router.use(protect);

// GET /api/tasks — list all tasks across all dates for the authenticated user
router.get('/', async (req, res) => {
  try {
    const logsObj = await getAllLogs(req.user.userId);
    const tasks = [];
    Object.entries(logsObj).forEach(([date, data]) => {
      (data.tasks || []).forEach(t => tasks.push({ ...t, date }));
    });
    res.json({ success: true, tasks });
  } catch (err) {
    console.error('GET /api/tasks error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
});

// POST /api/tasks — create a task (for a specific date)
router.post('/', async (req, res) => {
  try {
    const { date, ...taskData } = req.body;
    if (!date) return res.status(400).json({ success: false, error: 'Date is required' });
    const log = await getAllLogs(req.user.userId);
    const existing = log[date] || { tasks: [] };
    const newTask = {
      id: taskData.id || `task_${Date.now()}`,
      ...taskData,
      createdAt: taskData.createdAt || new Date().toISOString(),
    };
    const updated = { ...existing, tasks: [...(existing.tasks || []), newTask] };
    await upsertLog(req.user.userId, date, updated);
    res.status(201).json({ success: true, task: newTask });
  } catch (err) {
    console.error('POST /api/tasks error:', err);
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:date/:taskId — update a task
router.put('/:date/:taskId', async (req, res) => {
  try {
    const { date, taskId } = req.params;
    const log = await getAllLogs(req.user.userId);
    const existing = log[date] || { tasks: [] };
    const tasks = (existing.tasks || []).map(t =>
      t.id === taskId ? { ...t, ...req.body, updatedAt: new Date().toISOString() } : t
    );
    if (!existing.tasks?.some(t => t.id === taskId)) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    await upsertLog(req.user.userId, date, { ...existing, tasks });
    res.json({ success: true, task: tasks.find(t => t.id === taskId) });
  } catch (err) {
    console.error('PUT /api/tasks error:', err);
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:date/:taskId — delete a task
router.delete('/:date/:taskId', async (req, res) => {
  try {
    const { date, taskId } = req.params;
    const log = await getAllLogs(req.user.userId);
    const existing = log[date] || { tasks: [] };
    const tasks = (existing.tasks || []).filter(t => t.id !== taskId);
    if (tasks.length === (existing.tasks || []).length) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    await upsertLog(req.user.userId, date, { ...existing, tasks });
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    console.error('DELETE /api/tasks error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
});

module.exports = router;

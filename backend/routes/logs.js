const express             = require('express');
const router              = express.Router();
const { getAllLogs, upsertLog } = require('../db/logs');
const { protect }         = require('../middleware/auth');

// GET /api/daily — all logs for the authenticated user
router.get('/', protect, async (req, res) => {
  try {
    const logsObj = await getAllLogs(req.user.userId);
    res.json(logsObj);
  } catch (err) {
    console.error('[Logs] GET error:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/daily/:date — upsert log for a specific date
router.post('/:date', protect, async (req, res) => {
  try {
    const { date } = req.params;
    const data     = req.body;
    const result   = await upsertLog(req.user.userId, date, data);
    res.json(result);
  } catch (err) {
    console.error('[Logs] POST error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

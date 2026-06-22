const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAllAwsRecords,
  addService,
  updateService,
  addCert,
  updateCert,
  saveNote,
  getNoteByDate,
  deleteAwsRecord,
} = require('../db/aws');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const records = await getAllAwsRecords(req.user.userId);
    res.json(records);
  } catch (err) {
    console.error('[AWS] GET all error:', err);
    res.status(500).json({ message: 'Failed to fetch AWS records' });
  }
});

router.get('/note', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'date is required' });
    const note = await getNoteByDate(req.user.userId, date);
    res.json(note || null);
  } catch (err) {
    console.error('[AWS] GET note error:', err);
    res.status(500).json({ message: 'Failed to fetch note' });
  }
});

router.post('/service', async (req, res) => {
  try {
    const { service, description, category, keyFeatures, pricing, notes } = req.body;
    if (!service?.trim() || !description?.trim()) {
      return res.status(400).json({ message: 'service and description are required' });
    }
    const record = await addService(req.user.userId, {
      service: service.trim(),
      description: description.trim(),
      category,
      keyFeatures,
      pricing,
      notes,
    });
    res.status(201).json(record);
  } catch (err) {
    console.error('[AWS] POST service error:', err);
    res.status(500).json({ message: 'Failed to add service' });
  }
});

router.put('/service/:recordId', async (req, res) => {
  try {
    const updated = await updateService(req.user.userId, req.params.recordId, req.body);
    if (!updated) return res.status(404).json({ message: 'Record not found' });
    res.json(updated);
  } catch (err) {
    console.error('[AWS] PUT service error:', err);
    res.status(500).json({ message: 'Failed to update service' });
  }
});

router.post('/cert', async (req, res) => {
  try {
    const { certification, provider, status, examDate, score, notes } = req.body;
    if (!certification?.trim()) {
      return res.status(400).json({ message: 'certification name is required' });
    }
    const record = await addCert(req.user.userId, {
      certification: certification.trim(),
      provider: provider || 'AWS',
      status,
      examDate,
      score,
      notes,
    });
    res.status(201).json(record);
  } catch (err) {
    console.error('[AWS] POST cert error:', err);
    res.status(500).json({ message: 'Failed to add certification' });
  }
});

router.put('/cert/:recordId', async (req, res) => {
  try {
    const updated = await updateCert(req.user.userId, req.params.recordId, req.body);
    if (!updated) return res.status(404).json({ message: 'Record not found' });
    res.json(updated);
  } catch (err) {
    console.error('[AWS] PUT cert error:', err);
    res.status(500).json({ message: 'Failed to update certification' });
  }
});

router.post('/note', async (req, res) => {
  try {
    const { date, content, studyMinutes, topicsCovered } = req.body;
    if (!date || !content?.trim()) {
      return res.status(400).json({ message: 'date and content are required' });
    }
    const record = await saveNote(req.user.userId, date, {
      content: content.trim(),
      studyMinutes,
      topicsCovered,
    });
    res.json(record);
  } catch (err) {
    console.error('[AWS] POST note error:', err);
    res.status(500).json({ message: 'Failed to save note' });
  }
});

router.delete('/:recordId', async (req, res) => {
  try {
    const encodedId = req.params.recordId;
    const recordId = decodeURIComponent(encodedId);
    await deleteAwsRecord(req.user.userId, recordId);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[AWS] DELETE error:', err);
    res.status(500).json({ message: 'Failed to delete record' });
  }
});

module.exports = router;

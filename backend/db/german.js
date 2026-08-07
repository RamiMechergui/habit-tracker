/**
 * db/german.js
 * ─────────────────────────────────────────────────────────────────────────────
 * DynamoDB helpers for the German Learning System.
 *
 * Table: HabitGerman
 *   PK: userId    (HASH)
 *   SK: recordId  (RANGE) — prefixed: VOCAB#<uuid> | GRAMMAR#<uuid> | NOTE#YYYY-MM-DD
 */

const { docClient } = require('./dynamodb');
const {
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const TABLE = 'HabitGerman';

// ── Fetch all records ─────────────────────────────────────────────────────────
async function getAllGermanRecords(userId) {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }));
  return res.Items || [];
}

// Record types that belong to a CEFR level workspace. Study / progress / document
// records are excluded.
const LEVELED_TYPES = new Set(['vocab', 'grammar', 'note', 'verb', 'dialogue', 'memo', 'expression', 'idiom', 'mistake', 'alphabet', 'resource', 'book', 'chapter']);

// ── One-time backfill: stamp legacy records (created before levels existed) ──
// with the user's current level so every section is scoped correctly.
async function backfillLevels(userId, level) {
  const records = await getAllGermanRecords(userId);
  const missing = records.filter(r => LEVELED_TYPES.has(r.type) && !r.level);
  if (missing.length === 0) return 0;
  const now = new Date().toISOString();
  for (const r of missing) {
    await docClient.send(new UpdateCommand({
      TableName: TABLE,
      Key: { userId, recordId: r.recordId },
      UpdateExpression: 'SET #lvl = :lvl, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#lvl': 'level' },
      ExpressionAttributeValues: { ':lvl': level, ':updatedAt': now },
    }));
  }
  return missing.length;
}

// ── Vocabulary ────────────────────────────────────────────────────────────────
async function addVocab(userId, { word, translation, example = '', notes = '', category = 'General', plural = '', article = '', leitnerBox = 0, lastReviewDate = null, mastery = 0, favorite = false, sortOrder = Date.now(), photoUrl = '', boxes = [], level = 'A1.1', chapterId = null, chapterTitle = '' }) {
  const recordId = `VOCAB#${uuidv4()}`;
  const item = {
    userId,
    recordId,
    type: 'vocab',
    word,
    translation,
    example,
    notes,
    category,
    plural,
    article,
    leitnerBox,
    lastReviewDate,
    mastery,
    favorite,
    sortOrder,
    photoUrl,
    boxes,
    level,
    chapterId: chapterId || null,
    chapterTitle: chapterTitle || '',
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateVocab(userId, recordId, updates) {
  const allowed = ['word', 'translation', 'example', 'notes', 'category', 'plural', 'article', 'leitnerBox', 'lastReviewDate', 'mastery', 'favorite', 'sortOrder', 'photoUrl', 'easeFactor', 'interval', 'nextReviewDate', 'lapses', 'boxes', 'level', 'chapterId', 'chapterTitle'];
  const sets = [];
  const names = {};
  const values = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = updates[key];
    }
  }
  if (!sets.length) return null;
  sets.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();

  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

// ── Grammar ───────────────────────────────────────────────────────────────────
async function addGrammar(userId, { rule, explanation, examples = [], category = 'General', level = 'A1', mastery = 0, favorite = false, sortOrder = Date.now(), boxes = [], chapterId = null, chapterTitle = '' }) {
  const recordId = `GRAMMAR#${uuidv4()}`;
  const item = {
    userId,
    recordId,
    type: 'grammar',
    rule,
    explanation,
    examples,
    category,
    level,
    mastery,
    favorite,
    sortOrder,
    boxes,
    chapterId: chapterId || null,
    chapterTitle: chapterTitle || '',
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateGrammar(userId, recordId, updates) {
  const allowed = ['rule', 'explanation', 'examples', 'category', 'level', 'mastery', 'favorite', 'sortOrder', 'boxes', 'chapterId', 'chapterTitle'];
  const sets = [];
  const names = {};
  const values = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = updates[key];
    }
  }
  if (!sets.length) return null;
  sets.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();

  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

// ── Daily Notes ───────────────────────────────────────────────────────────────
// Supports multiple notes per day. recordId: NOTE#YYYY-MM-DD#<uuid>
// Notes can be attached to a chapter (chapterId + denormalized chapterTitle) so
// they are organized under a selected study chapter while keeping their date.
async function saveNote(userId, date, { noteId, title, content, boxes, noteCategory, studyMinutes, level = 'A1.1', chapterId = null, chapterTitle = '', createdAt }) {
  const recordId = noteId || `NOTE#${date}#${uuidv4()}`;
  const item = {
    userId,
    recordId,
    type: 'note',
    date,
    title: title || '',
    content,
    boxes: boxes || [],
    noteCategory: noteCategory || 'daily',
    studyMinutes: studyMinutes ? parseInt(studyMinutes) || 0 : 0,
    level,
    chapterId: chapterId || null,
    chapterTitle: chapterTitle || '',
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function getNotesByDate(userId, date) {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'userId = :uid AND begins_with(recordId, :prefix)',
    ExpressionAttributeValues: { ':uid': userId, ':prefix': `NOTE#${date}` },
  }));
  return (res.Items || []).sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''));
}

async function getNoteByDate(userId, date) {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { userId, recordId: `NOTE#${date}` },
  }));
  return res.Item || null;
}

// ── Verbs ──────────────────────────────────────────────────────────────────────
async function addVerb(userId, { infinitive, meaning, ich = '', du = '', erSieEs = '', wir = '', ihr = '', Sie = '', category = 'General', favorite = false, sortOrder = Date.now(), boxes = [], level = 'A1.1', chapterId = null, chapterTitle = '' }) {
  const recordId = `VERB#${uuidv4()}`;
  const item = {
    userId, recordId, type: 'verb',
    infinitive, meaning,
    ich, du, erSieEs, wir, ihr, Sie,
    category,
    favorite,
    sortOrder,
    boxes,
    level,
    chapterId: chapterId || null,
    chapterTitle: chapterTitle || '',
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateVerb(userId, recordId, updates) {
  const allowed = ['infinitive', 'meaning', 'ich', 'du', 'erSieEs', 'wir', 'ihr', 'Sie', 'category', 'favorite', 'sortOrder', 'boxes', 'level', 'chapterId', 'chapterTitle'];
  const sets = [];
  const names = {};
  const values = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = updates[key];
    }
  }
  if (!sets.length) return null;
  sets.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();

  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

// ── Dialogues ──────────────────────────────────────────────────────────────────
async function addDialogue(userId, { title, level, participants, exchanges, sortOrder = Date.now(), boxes = [], chapterId = null, chapterTitle = '' }) {
  const recordId = `DIALOGUE#${uuidv4()}`;
  const item = {
    userId,
    recordId,
    type: 'dialogue',
    title,
    level,
    participants,
    exchanges,
    sortOrder,
    boxes,
    chapterId: chapterId || null,
    chapterTitle: chapterTitle || '',
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateDialogue(userId, recordId, updates) {
  const allowed = ['title', 'level', 'participants', 'exchanges', 'sortOrder', 'boxes', 'chapterId', 'chapterTitle'];
  const sets = [];
  const names = {};
  const values = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = updates[key];
    }
  }
  if (!sets.length) return null;
  sets.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();

  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

// ── Memorization Paragraphs ────────────────────────────────────────────────────
async function addMemo(userId, { title, content, germanContent = '', englishContent = '', memoFont = '', sortOrder = Date.now(), boxes = [], level = 'A1.1', chapterId = null, chapterTitle = '' }) {
  const recordId = `MEMO#${uuidv4()}`;
  const item = {
    userId, recordId, type: 'memo',
    title,
    content,
    germanContent,
    englishContent,
    memoFont,
    sortOrder,
    boxes,
    level,
    chapterId: chapterId || null,
    chapterTitle: chapterTitle || '',
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateMemo(userId, recordId, updates) {
  const allowed = ['title', 'content', 'sortOrder', 'boxes', 'germanContent', 'englishContent', 'memoFont', 'level', 'chapterId', 'chapterTitle'];
  const sets = [];
  const names = {};
  const values = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = updates[key];
    }
  }
  if (!sets.length) return null;
  sets.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

// ── Documents ─────────────────────────────────────────────────────────────────
async function addDocument(userId, { title = 'Untitled Document', docType = 'notebook', content = {}, metadata = {} }) {
  const recordId = `DOC#${uuidv4()}`;
  const item = {
    userId,
    recordId,
    type: 'document',
    docType,
    title,
    content,
    metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateDocument(userId, recordId, updates) {
  const allowed = ['title', 'docType', 'content', 'metadata'];
  const sets = [];
  const names = {};
  const values = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = updates[key];
    }
  }
  if (!sets.length) return null;
  sets.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();

  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

// ── Delete (any type) ─────────────────────────────────────────────────────────
async function deleteGermanRecord(userId, recordId) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE,
    Key: { userId, recordId },
  }));
  return true;
}

// ── Useful Expressions ────────────────────────────────────────────────────────
async function addExpression(userId, { phrase, translation, category = 'General', favorite = false, sortOrder = Date.now(), boxes = [], level = 'A1.1', chapterId = null, chapterTitle = '' }) {
  const recordId = `EXPRESSION#${uuidv4()}`;
  const item = {
    userId, recordId, type: 'expression',
    phrase, translation, category, favorite, sortOrder, boxes, level,
    chapterId: chapterId || null,
    chapterTitle: chapterTitle || '',
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateExpression(userId, recordId, updates) {
  const allowed = ['phrase', 'translation', 'category', 'favorite', 'sortOrder', 'boxes', 'level', 'chapterId', 'chapterTitle'];
  const sets = [];
  const names = {};
  const values = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = updates[key];
    }
  }
  if (!sets.length) return null;
  sets.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

// ── Useful Idioms ─────────────────────────────────────────────────────────────
async function addIdiom(userId, { phrase, translation, meaning = '', usage = '', category = 'General', favorite = false, sortOrder = Date.now(), level = 'A1.1', chapterId = null, chapterTitle = '' }) {
  const recordId = `IDIOM#${uuidv4()}`;
  const item = {
    userId, recordId, type: 'idiom',
    phrase, translation, meaning, usage, category, favorite, sortOrder, level,
    chapterId: chapterId || null,
    chapterTitle: chapterTitle || '',
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateIdiom(userId, recordId, updates) {
  const allowed = ['phrase', 'translation', 'meaning', 'usage', 'category', 'favorite', 'sortOrder', 'level', 'chapterId', 'chapterTitle'];
  const sets = [];
  const names = {};
  const values = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = updates[key];
    }
  }
  if (!sets.length) return null;
  sets.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

// ── Mistakes to Avoid ────────────────────────────────────────────────────────
async function addMistake(userId, { incorrect, correct, why = '', category = 'General', favorite = false, sortOrder = Date.now(), level = 'A1.1', chapterId = null, chapterTitle = '' }) {
  const recordId = `MISTAKE#${uuidv4()}`;
  const item = {
    userId, recordId, type: 'mistake',
    incorrect, correct, why, category, favorite, sortOrder, level,
    chapterId: chapterId || null,
    chapterTitle: chapterTitle || '',
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateMistake(userId, recordId, updates) {
  const allowed = ['incorrect', 'correct', 'why', 'category', 'favorite', 'sortOrder', 'level', 'chapterId', 'chapterTitle'];
  const sets = [];
  const names = {};
  const values = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = updates[key];
    }
  }
  if (!sets.length) return null;
  sets.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

// ── Chapters (course chapters per CEFR level) ────────────────────────────────
async function addChapter(userId, { title, level = 'A1.1', sortOrder = Date.now() }) {
  const recordId = `CHAPTER#${uuidv4()}`;
  const item = {
    userId,
    recordId,
    type: 'chapter',
    title,
    level,
    sortOrder,
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateChapter(userId, recordId, updates) {
  const allowed = ['title', 'level', 'sortOrder'];
  const sets = [];
  const names = {};
  const values = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = updates[key];
    }
  }
  if (!sets.length) return null;
  sets.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();

  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

// ── Study time tracking ───────────────────────────────────────────────────────
const STUDY_RECORD = 'STUDY#v1';
async function getStudy(userId) {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { userId, recordId: STUDY_RECORD },
  }));
  return res.Item || null;
}

async function initStudy(userId) {
  const item = {
    userId,
    recordId: STUDY_RECORD,
    type: 'study',
    totalMs: 0,
    days: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function getOrInitStudy(userId) {
  const existing = await getStudy(userId);
  if (existing) return existing;
  return initStudy(userId);
}

async function addStudyMs(userId, date, ms) {
  const state = await getOrInitStudy(userId);
  const days = { ...(state.days || {}) };
  days[date] = (parseInt(days[date]) || 0) + ms;
  const updated = {
    ...state,
    totalMs: (parseInt(state.totalMs) || 0) + ms,
    days,
    updatedAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: updated }));
  return updated;
}

async function resetStudyTotal(userId) {
  const state = await getOrInitStudy(userId);
  const updated = {
    ...state,
    totalMs: 0,
    updatedAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: updated }));
  return updated;
}

async function resetStudyDay(userId, date) {
  const state = await getOrInitStudy(userId);
  const days = { ...(state.days || {}) };
  const removedMs = parseInt(days[date]) || 0;
  delete days[date];
  const updated = {
    ...state,
    totalMs: Math.max(0, (parseInt(state.totalMs) || 0) - removedMs),
    days,
    updatedAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: updated }));
  return updated;
}

// ── Books (physical / PDF books being studied) ───────────────────────────────
async function addBook(userId, { name, author = '', notes = '', photoUrl = '', sortOrder = Date.now(), level = 'A1.1', chapterId = null, chapterTitle = '' }) {
  const recordId = `BOOK#${uuidv4()}`;
  const item = {
    userId, recordId, type: 'book',
    name, author, notes, photoUrl, sortOrder, level,
    chapterId: chapterId || null,
    chapterTitle: chapterTitle || '',
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateBook(userId, recordId, updates) {
  const allowed = ['name', 'author', 'notes', 'photoUrl', 'sortOrder', 'level', 'chapterId', 'chapterTitle'];
  const sets = [];
  const names = {};
  const values = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = updates[key];
    }
  }
  if (!sets.length) return null;
  sets.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

module.exports = {
  getAllGermanRecords,
  backfillLevels,
  addVocab,
  updateVocab,
  addGrammar,
  updateGrammar,
  addVerb,
  updateVerb,
  saveNote,
  getNoteByDate,
  getNotesByDate,
  deleteGermanRecord,
  addDialogue,
  updateDialogue,
  addMemo,
  updateMemo,
  addDocument,
  updateDocument,
  addExpression,
  updateExpression,
  addIdiom,
  updateIdiom,
  addMistake,
  updateMistake,
  addAlphabet,
  updateAlphabet,
  addResource,
  updateResource,
  addBook,
  updateBook,
  addChapter,
  updateChapter,
  getOrInitStudy,
  addStudyMs,
  resetStudyTotal,
  resetStudyDay,
};

// ── Alphabets ────────────────────────────────────────────────────────────────
async function addAlphabet(userId, { letter, example, english = '', pronunciation = '', photoUrl = '', sortOrder = Date.now(), level = 'A1.1' }) {
  const recordId = `ALPHABET#${uuidv4()}`;
  const item = {
    userId, recordId, type: 'alphabet',
    letter, example, english, pronunciation, photoUrl, sortOrder, level,
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateAlphabet(userId, recordId, updates) {
  const allowed = ['letter', 'example', 'english', 'pronunciation', 'photoUrl', 'sortOrder', 'level'];
  const sets = [];
  const names = {};
  const values = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = updates[key];
    }
  }
  if (!sets.length) return null;
  sets.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

// ── Resources (YouTube videos / channels) ─────────────────────────────────────
async function addResource(userId, { url, kind = 'video', videoId = '', channelId = '', handle = '', title = '', author = '', thumbnail = '', notes = '', sortOrder = Date.now(), level = 'A1.1', chapterId = null, chapterTitle = '' }) {
  const recordId = `RESOURCE#${uuidv4()}`;
  const item = {
    userId, recordId, type: 'resource',
    url, kind, videoId, channelId, handle, title, author, thumbnail, notes, sortOrder, level,
    chapterId: chapterId || null,
    chapterTitle: chapterTitle || '',
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateResource(userId, recordId, updates) {
  const allowed = ['url', 'kind', 'videoId', 'channelId', 'handle', 'title', 'author', 'thumbnail', 'notes', 'sortOrder', 'level', 'chapterId', 'chapterTitle'];
  const sets = [];
  const names = {};
  const values = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = updates[key];
    }
  }
  if (!sets.length) return null;
  sets.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

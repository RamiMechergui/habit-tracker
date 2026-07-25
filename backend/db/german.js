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

// ── Vocabulary ────────────────────────────────────────────────────────────────
async function addVocab(userId, { word, translation, example = '', notes = '', category = 'General', plural = '', leitnerBox = 0, lastReviewDate = null, mastery = 0, favorite = false, sortOrder = Date.now(), photoUrl = '' }) {
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
    leitnerBox,
    lastReviewDate,
    mastery,
    favorite,
    sortOrder,
    photoUrl,
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateVocab(userId, recordId, updates) {
  const allowed = ['word', 'translation', 'example', 'notes', 'category', 'plural', 'leitnerBox', 'lastReviewDate', 'mastery', 'favorite', 'sortOrder', 'photoUrl', 'easeFactor', 'interval', 'nextReviewDate', 'lapses'];
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
async function addGrammar(userId, { rule, explanation, examples = [], category = 'General', level = 'A1', mastery = 0, favorite = false, sortOrder = Date.now() }) {
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
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateGrammar(userId, recordId, updates) {
  const allowed = ['rule', 'explanation', 'examples', 'category', 'level', 'mastery', 'favorite', 'sortOrder'];
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
async function saveNote(userId, date, { noteId, content, boxes }) {
  const recordId = noteId || `NOTE#${date}#${uuidv4()}`;
  const item = {
    userId,
    recordId,
    type: 'note',
    date,
    content,
    boxes: boxes || [],
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
async function addVerb(userId, { infinitive, meaning, ich = '', du = '', erSieEs = '', wir = '', ihr = '', Sie = '', category = 'General', favorite = false, sortOrder = Date.now() }) {
  const recordId = `VERB#${uuidv4()}`;
  const item = {
    userId, recordId, type: 'verb',
    infinitive, meaning,
    ich, du, erSieEs, wir, ihr, Sie,
    category,
    favorite,
    sortOrder,
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateVerb(userId, recordId, updates) {
  const allowed = ['infinitive', 'meaning', 'ich', 'du', 'erSieEs', 'wir', 'ihr', 'Sie', 'category', 'favorite', 'sortOrder'];
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
async function addDialogue(userId, { title, level, participants, exchanges, sortOrder = Date.now() }) {
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
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateDialogue(userId, recordId, updates) {
  const allowed = ['title', 'level', 'participants', 'exchanges', 'sortOrder'];
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
async function addMemo(userId, { title, content, sortOrder = Date.now() }) {
  const recordId = `MEMO#${uuidv4()}`;
  const item = {
    userId, recordId, type: 'memo',
    title,
    content,
    sortOrder,
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateMemo(userId, recordId, updates) {
  const allowed = ['title', 'content', 'sortOrder'];
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

module.exports = {
  getAllGermanRecords,
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
};

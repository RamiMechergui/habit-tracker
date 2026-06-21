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
async function addVocab(userId, { word, translation, example = '', notes = '', category = 'General' }) {
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
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateVocab(userId, recordId, updates) {
  const allowed = ['word', 'translation', 'example', 'notes', 'category'];
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
async function addGrammar(userId, { rule, explanation, examples = [], category = 'General' }) {
  const recordId = `GRAMMAR#${uuidv4()}`;
  const item = {
    userId,
    recordId,
    type: 'grammar',
    rule,
    explanation,
    examples,
    category,
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateGrammar(userId, recordId, updates) {
  const allowed = ['rule', 'explanation', 'examples', 'category'];
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
// recordId is NOTE#YYYY-MM-DD so there can only be one note per day
async function saveNote(userId, date, { content, studyMinutes = 0, wordsLearned = 0 }) {
  const recordId = `NOTE#${date}`;
  const item = {
    userId,
    recordId,
    type: 'note',
    date,
    content,
    studyMinutes,
    wordsLearned,
    updatedAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function getNoteByDate(userId, date) {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { userId, recordId: `NOTE#${date}` },
  }));
  return res.Item || null;
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
  saveNote,
  getNoteByDate,
  deleteGermanRecord,
};

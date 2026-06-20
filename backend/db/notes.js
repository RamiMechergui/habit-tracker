/**
 * db/notes.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Data Access Object for the HabitNotes table.
 *
 * Key schema:
 *   PK: userId (String)
 *   SK: noteId (String, UUID)
 *   GSI UserDateIndex: PK = userId, SK = date
 *
 * Multiple notes can exist per date, so we use a UUID sort key on the base
 * table. The GSI enables efficient date-filtered queries.
 */

const {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamodb');
const { randomUUID } = require('crypto');

const TABLE = 'HabitNotes';

/** Map DynamoDB item → API shape (keeps _id for frontend compatibility) */
function toNoteShape(item) {
  if (!item) return null;
  return {
    _id:       item.noteId,
    noteId:    item.noteId,
    userId:    item.userId,
    date:      item.date,
    content:   item.content,
    section:   item.section || '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/**
 * Returns all notes for a user sorted newest-first.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getAllNotes(userId) {
  const items  = [];
  let lastKey;
  do {
    const res = await docClient.send(new QueryCommand({
      TableName:                 TABLE,
      KeyConditionExpression:    'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ExclusiveStartKey:         lastKey,
    }));
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  // Sort newest-first (createdAt desc) in application layer
  items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return items.map(toNoteShape);
}

/**
 * Returns all notes for a user on a specific date (uses UserDateIndex GSI).
 * @param {string} userId
 * @param {string} date — YYYY-MM-DD
 * @returns {Promise<Array>}
 */
async function getNotesByDate(userId, date) {
  const items  = [];
  let lastKey;
  do {
    const res = await docClient.send(new QueryCommand({
      TableName:                 TABLE,
      IndexName:                 'UserDateIndex',
      KeyConditionExpression:    'userId = :uid AND #dt = :date',
      ExpressionAttributeNames:  { '#dt': 'date' },
      ExpressionAttributeValues: { ':uid': userId, ':date': date },
      ExclusiveStartKey:         lastKey,
    }));
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return items.map(toNoteShape);
}

/**
 * Creates a new note.
 * @param {string} userId
 * @param {string} date
 * @param {string} content
 * @returns {Promise<object>}
 */
async function createNote(userId, date, content, section = '') {
  const ts     = new Date().toISOString();
  const noteId = randomUUID();
  const item   = { userId, noteId, date, content, section, createdAt: ts, updatedAt: ts };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return toNoteShape(item);
}

/**
 * Updates the content of a note.
 * @param {string} userId
 * @param {string} noteId
 * @param {string} content
 * @returns {Promise<object|null>}
 */
async function updateNote(userId, noteId, content, section) {
  const ts  = new Date().toISOString();
  let UpdateExpression = 'SET content = :c, updatedAt = :ts';
  const ExpressionAttributeValues = { ':c': content, ':ts': ts };
  
  if (section !== undefined) {
    UpdateExpression += ', #sec = :sec';
    ExpressionAttributeValues[':sec'] = section;
  }
  
  const params = {
    TableName:                 TABLE,
    Key:                       { userId, noteId },
    UpdateExpression,
    ConditionExpression:       'attribute_exists(noteId)',
    ExpressionAttributeValues,
    ReturnValues:              'ALL_NEW',
  };
  
  if (section !== undefined) {
    params.ExpressionAttributeNames = { '#sec': 'section' };
  }

  const res = await docClient.send(new UpdateCommand(params));
  return toNoteShape(res.Attributes);
}

/**
 * Deletes a note by userId + noteId.
 * @param {string} userId
 * @param {string} noteId
 * @returns {Promise<boolean>} true if deleted, false if not found
 */
async function deleteNote(userId, noteId) {
  try {
    await docClient.send(new DeleteCommand({
      TableName:           TABLE,
      Key:                 { userId, noteId },
      ConditionExpression: 'attribute_exists(noteId)',
    }));
    return true;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}

module.exports = { getAllNotes, getNotesByDate, createNote, updateNote, deleteNote };

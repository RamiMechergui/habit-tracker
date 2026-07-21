/**
 * db/users.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Data Access Object for the HabitUsers table.
 *
 * Key schema:
 *   PK: userId (String)
 *   GSI EmailIndex: PK = email
 *
 * Embedded in the User item:
 *   expenseCategories[], essentials[], currentBook{}, archivedBooks[]
 */

const {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamodb');

const TABLE = 'HabitUsers';

const DEFAULT_EXPENSE_CATEGORIES = [
  'Transportation', 'Food & Dining', 'Clothes',
  'Tech & Electronics', 'Groceries', 'Entertainment', 'Health', 'Other',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function now() {
  return new Date().toISOString();
}

/**
 * Strips the DynamoDB item down to the shape the rest of the app expects.
 * Crucially it maps userId → _id so the frontend never has to change.
 */
function toUserShape(item) {
  if (!item) return null;
  return {
    _id:               item.userId,
    userId:            item.userId,
    email:             item.email,
    passwordHash:      item.passwordHash,
    firstName:         item.firstName  || '',
    lastName:          item.lastName   || '',
    profilePicture:    item.profilePicture || '',
    avatarVersion:     item.avatarVersion || 0,
    expenseCategories: item.expenseCategories || DEFAULT_EXPENSE_CATEGORIES,
    currentBook:       item.currentBook ? { ...item.currentBook, photoUrl: item.currentBook.photoUrl || '', author: item.currentBook.author || '' } : { bookName: '', targetPages: 0, startDate: '', isActive: false, photoUrl: '', author: '' },
    archivedBooks:     item.archivedBooks || [],
    plannedBooks:      item.plannedBooks || [],
    history:           item.history || [],
    essentials:        (item.essentials || []).map(e => ({ ...e, _id: e.essentialId })),
    pushSubscription:  item.pushSubscription || null,
    createdAt:         item.createdAt,
    updatedAt:         item.updatedAt,
  };
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

/**
 * Creates a new user.
 * @param {{ userId: string, email: string, passwordHash: string, firstName?: string, lastName?: string }} data
 */
async function createUser(data) {
  const ts = now();
  const item = {
    userId:            data.userId,
    email:             data.email.toLowerCase().trim(),
    passwordHash:      data.passwordHash,
    firstName:         data.firstName  || '',
    lastName:          data.lastName   || '',
    profilePicture:    '',
    expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
    currentBook:       { bookName: '', targetPages: 0, startDate: '', isActive: false, photoUrl: '' },
    archivedBooks:     [],
    plannedBooks:      [],
    history:           [],
    essentials:        [],
    pushSubscription:  null,
    createdAt:         ts,
    updatedAt:         ts,
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return toUserShape(item);
}

/**
 * Fetches a user by userId.
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function getUserById(userId) {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { userId },
  }));
  return toUserShape(res.Item || null);
}

/**
 * Fetches a user by email (uses EmailIndex GSI).
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function getUserByEmail(email) {
  const res = await docClient.send(new QueryCommand({
    TableName:              TABLE,
    IndexName:              'EmailIndex',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': email.toLowerCase().trim() },
    Limit: 1,
  }));
  return toUserShape((res.Items || [])[0] || null);
}

/**
 * Updates arbitrary fields on a user item.
 * @param {string} userId
 * @param {object} fields — plain object of field→value pairs
 */
async function updateUser(userId, fields) {
  const ts = now();
  const updates = { ...fields, updatedAt: ts };
  const keys    = Object.keys(updates);

  const SetExpressions = keys.map((k, i) => `#f${i} = :v${i}`);
  const ExpressionAttributeNames   = {};
  const ExpressionAttributeValues  = {};
  keys.forEach((k, i) => {
    ExpressionAttributeNames[`#f${i}`]  = k;
    ExpressionAttributeValues[`:v${i}`] = updates[k];
  });

  const res = await docClient.send(new UpdateCommand({
    TableName:                 TABLE,
    Key:                       { userId },
    UpdateExpression:          `SET ${SetExpressions.join(', ')}`,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
    ReturnValues:              'ALL_NEW',
  }));
  return toUserShape(res.Attributes);
}

/**
 * Deletes a user by userId.
 * @param {string} userId
 */
async function deleteUser(userId) {
  await docClient.send(new DeleteCommand({ TableName: TABLE, Key: { userId } }));
}

/**
 * Returns the total count of users (admin dashboard).
 * Uses a Scan with Select=COUNT — acceptable for small/medium user bases.
 * @returns {Promise<number>}
 */
async function countUsers() {
  let count = 0;
  let lastKey;
  do {
    const res = await docClient.send(new ScanCommand({
      TableName:        TABLE,
      Select:           'COUNT',
      ExclusiveStartKey: lastKey,
    }));
    count  += res.Count || 0;
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return count;
}

/**
 * Returns a list of all users with basic fields (admin dashboard).
 * @returns {Promise<Array>}
 */
async function listUsers() {
  const items   = [];
  let lastKey;
  do {
    const res = await docClient.send(new ScanCommand({
      TableName:                 TABLE,
      ProjectionExpression:      'userId, email, firstName, lastName, createdAt',
      ExclusiveStartKey:         lastKey,
    }));
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items.map(u => ({
    userId:    u.userId,
    _id:       u.userId,
    email:     u.email,
    firstName: u.firstName || '',
    lastName:  u.lastName  || '',
    createdAt: u.createdAt,
  }));
}

module.exports = { createUser, getUserById, getUserByEmail, updateUser, deleteUser, countUsers, listUsers };

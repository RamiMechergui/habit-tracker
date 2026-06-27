/**
 * db/credentials.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Data Access Object for the HabitCredentials table.
 *
 * Key schema:
 *   PK: userId       (String)
 *   SK: credentialId (String, UUID)
 *
 * Passwords and notes fields are stored AES-encrypted (handled in the route
 * layer via utils/crypto.js — this DAO stores/retrieves raw strings).
 */

const {
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamodb');
const { randomUUID } = require('crypto');

const TABLE = 'HabitCredentials';

/** Map DynamoDB item → API shape (keeps _id for frontend compatibility) */
function toCredShape(item) {
  if (!item) return null;
  return {
    _id:          item.credentialId,
    credentialId: item.credentialId,
    userId:       item.userId,
    serviceName:  item.serviceName,
    url:          item.url          || '',
    username:     item.username,
    password:     item.password,
    secondaryUsername: item.secondaryUsername || '',
    secondaryPassword: item.secondaryPassword || '',
    notes:        item.notes        || '',
    category:     item.category     || 'Other',
    isPinned:     !!item.isPinned,
    tags:         item.tags         || [],
    createdAt:    item.createdAt,
    updatedAt:    item.updatedAt,
  };
}

/**
 * Returns all credentials for a user, sorted alphabetically by serviceName.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getAllCredentials(userId) {
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
  // Sort alphabetically by serviceName (application layer)
  items.sort((a, b) => (a.serviceName || '').localeCompare(b.serviceName || ''));
  return items.map(toCredShape);
}

/**
 * Creates a new credential entry.
 * @param {string} userId
 * @param {{ serviceName, url, username, password, notes, category, isPinned, tags }} data
 * @returns {Promise<object>}
 */
async function createCredential(userId, data) {
  const ts           = new Date().toISOString();
  const credentialId = randomUUID();
  const item = {
    userId,
    credentialId,
    serviceName: data.serviceName,
    url:         data.url         || '',
    username:    data.username,
    password:    data.password,
    secondaryUsername: data.secondaryUsername || '',
    secondaryPassword: data.secondaryPassword || '',
    notes:       data.notes       || '',
    category:    data.category    || 'Other',
    isPinned:    !!data.isPinned,
    tags:        data.tags        || [],
    createdAt:   ts,
    updatedAt:   ts,
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return toCredShape(item);
}

/**
 * Updates an existing credential. Only provided fields are updated.
 * @param {string} userId
 * @param {string} credentialId
 * @param {object} updates
 * @returns {Promise<object|null>}
 */
async function updateCredential(userId, credentialId, updates) {
  const ts = new Date().toISOString();
  const fields = { ...updates, updatedAt: ts };
  const keys   = Object.keys(fields);

  const SetExpressions = keys.map((k, i) => `#f${i} = :v${i}`);
  const ExpressionAttributeNames  = {};
  const ExpressionAttributeValues = {};
  keys.forEach((k, i) => {
    ExpressionAttributeNames[`#f${i}`]  = k;
    ExpressionAttributeValues[`:v${i}`] = fields[k];
  });

  try {
    const res = await docClient.send(new UpdateCommand({
      TableName:                 TABLE,
      Key:                       { userId, credentialId },
      UpdateExpression:          `SET ${SetExpressions.join(', ')}`,
      ConditionExpression:       'attribute_exists(credentialId)',
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues:              'ALL_NEW',
    }));
    return toCredShape(res.Attributes);
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  }
}

/**
 * Deletes a credential by userId + credentialId.
 * @param {string} userId
 * @param {string} credentialId
 * @returns {Promise<boolean>}
 */
async function deleteCredential(userId, credentialId) {
  try {
    await docClient.send(new DeleteCommand({
      TableName:           TABLE,
      Key:                 { userId, credentialId },
      ConditionExpression: 'attribute_exists(credentialId)',
    }));
    return true;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}

module.exports = { getAllCredentials, createCredential, updateCredential, deleteCredential };

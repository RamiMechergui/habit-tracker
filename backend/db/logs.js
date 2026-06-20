/**
 * db/logs.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Data Access Object for the HabitLogs table.
 *
 * Key schema:
 *   PK: userId (String)
 *   SK: date   (String, YYYY-MM-DD)
 */

const { GetCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamodb');

const TABLE = 'HabitLogs';

/**
 * Returns all log entries for a user as a { date: data } dictionary.
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getAllLogs(userId) {
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

  // Transform into the fast-lookup dict the frontend expects
  const dict = {};
  items.forEach(l => { dict[l.date] = l.data; });
  return dict;
}

/**
 * Creates or replaces the log entry for a specific date.
 * (Equivalent to Mongoose findOneAndUpdate with upsert:true)
 * @param {string} userId
 * @param {string} date   — YYYY-MM-DD
 * @param {object} data   — arbitrary habit payload
 * @returns {Promise<object>} — the stored data blob
 */
async function upsertLog(userId, date, data) {
  const ts = new Date().toISOString();
  const item = { userId, date, data, updatedAt: ts };

  // Use a conditional to set createdAt only on first write
  try {
    await docClient.send(new PutCommand({
      TableName:           TABLE,
      Item:                { ...item, createdAt: ts },
      ConditionExpression: 'attribute_not_exists(userId)',
    }));
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      // Item exists — update without touching createdAt
      await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
    } else {
      throw err;
    }
  }
  return data;
}

module.exports = { getAllLogs, upsertLog };

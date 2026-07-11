/**
 * db/expenses.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Data Access Object for the HabitExpenses table.
 *
 * Key schema:
 *   PK: userId (String)
 *   SK: date   (String, YYYY-MM-DD)
 */

const {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamodb');

const TABLE = 'HabitExpenses';

/**
 * Returns all expense documents for a user sorted by date descending.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getAllExpenses(userId) {
  const items  = [];
  let lastKey;
  do {
    const res = await docClient.send(new QueryCommand({
      TableName:                 TABLE,
      KeyConditionExpression:    'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ScanIndexForward:          false, // descending by date
      ExclusiveStartKey:         lastKey,
    }));
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

/**
 * Returns a single expense document for a specific date, or a default empty one.
 * @param {string} userId
 * @param {string} date — YYYY-MM-DD
 * @returns {Promise<object>}
 */
async function getExpenseByDate(userId, date) {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { userId, date },
  }));
  return res.Item || { userId, date, expenses: [] };
}

/**
 * Creates or replaces an expense record for a given date (upsert).
 * @param {string} userId
 * @param {string} date
 * @param {Array}  expenses
 * @returns {Promise<object>}
 */
async function upsertExpense(userId, date, expenses, income) {
  const ts   = new Date().toISOString();
  const item = { userId, date, expenses: expenses || [], income: income || [], updatedAt: ts };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

/**
 * Deletes the expense record for a given date.
 * @param {string} userId
 * @param {string} date
 */
async function deleteExpense(userId, date) {
  await docClient.send(new DeleteCommand({ TableName: TABLE, Key: { userId, date } }));
}

module.exports = { getAllExpenses, getExpenseByDate, upsertExpense, deleteExpense };

const { PutCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamodb');
const { randomUUID } = require('crypto');

const TABLE = 'HabitSavings';

function toShape(item) {
  if (!item) return null;
  return {
    _id: item.entryId,
    entryId: item.entryId,
    userId: item.userId,
    date: item.date,
    amount: item.amount,
    type: item.type || 'deposit',
    note: item.note || '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function getAll(userId) {
  const items = [];
  let lastKey;
  do {
    const res = await docClient.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  items.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  return items.map(toShape);
}

async function createEntry(userId, { date, amount, type, note }) {
  const ts = new Date().toISOString();
  const entryId = randomUUID();
  const item = { userId, entryId, date, amount: Number(amount), type: type || 'deposit', note: note || '', createdAt: ts, updatedAt: ts };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return toShape(item);
}

async function updateEntry(userId, entryId, updates) {
  const ts = new Date().toISOString();
  const expr = [];
  const attrValues = { ':ts': ts };
  const attrNames = {};

  if (updates.date !== undefined) { expr.push('#dt = :dt'); attrValues[':dt'] = updates.date; attrNames['#dt'] = 'date'; }
  if (updates.amount !== undefined) { expr.push('#am = :am'); attrValues[':am'] = Number(updates.amount); attrNames['#am'] = 'amount'; }
  if (updates.type !== undefined) { expr.push('#ty = :ty'); attrValues[':ty'] = updates.type; attrNames['#ty'] = 'type'; }
  if (updates.note !== undefined) { expr.push('#nt = :nt'); attrValues[':nt'] = updates.note; attrNames['#nt'] = 'note'; }
  expr.push('#up = :ts');
  attrNames['#up'] = 'updatedAt';

  if (expr.length <= 1) return toShape({ userId, entryId, ...updates });

  try {
    const res = await docClient.send(new UpdateCommand({
      TableName: TABLE,
      Key: { userId, entryId },
      UpdateExpression: `SET ${expr.join(', ')}`,
      ExpressionAttributeNames: attrNames,
      ExpressionAttributeValues: attrValues,
      ConditionExpression: 'attribute_exists(entryId)',
      ReturnValues: 'ALL_NEW',
    }));
    return toShape(res.Attributes);
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  }
}

async function deleteEntry(userId, entryId) {
  try {
    await docClient.send(new DeleteCommand({
      TableName: TABLE,
      Key: { userId, entryId },
      ConditionExpression: 'attribute_exists(entryId)',
    }));
    return true;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}

module.exports = { getAll, createEntry, updateEntry, deleteEntry };

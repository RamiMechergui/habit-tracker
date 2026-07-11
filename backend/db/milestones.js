const { PutCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamodb');
const { randomUUID } = require('crypto');

const TABLE = 'HabitMilestones';

function toShape(item) {
  if (!item) return null;
  return {
    _id: item.milestoneId,
    milestoneId: item.milestoneId,
    userId: item.userId,
    habitName: item.habitName,
    lastDate: item.lastDate,
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
  items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return items.map(toShape);
}

async function createItem(userId, { habitName, lastDate }) {
  const ts = new Date().toISOString();
  const milestoneId = randomUUID();
  const item = { userId, milestoneId, habitName, lastDate, createdAt: ts, updatedAt: ts };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return toShape(item);
}

async function updateItem(userId, milestoneId, updates) {
  const ts = new Date().toISOString();
  const expr = [];
  const attrValues = { ':ts': ts };
  const attrNames = {};

  if (updates.habitName !== undefined) { expr.push('#hn = :hn'); attrValues[':hn'] = updates.habitName; attrNames['#hn'] = 'habitName'; }
  if (updates.lastDate !== undefined) { expr.push('#ld = :ld'); attrValues[':ld'] = updates.lastDate; attrNames['#ld'] = 'lastDate'; }
  expr.push('#up = :ts');
  attrNames['#up'] = 'updatedAt';

  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, milestoneId },
    UpdateExpression: `SET ${expr.join(', ')}`,
    ExpressionAttributeNames: attrNames,
    ExpressionAttributeValues: attrValues,
    ConditionExpression: 'attribute_exists(milestoneId)',
    ReturnValues: 'ALL_NEW',
  }));
  return toShape(res.Attributes);
}

async function deleteItem(userId, milestoneId) {
  try {
    await docClient.send(new DeleteCommand({
      TableName: TABLE,
      Key: { userId, milestoneId },
      ConditionExpression: 'attribute_exists(milestoneId)',
    }));
    return true;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}

module.exports = { getAll, createItem, updateItem, deleteItem };

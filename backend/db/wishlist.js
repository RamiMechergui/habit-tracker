const { PutCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamodb');
const { randomUUID } = require('crypto');

const TABLE = 'HabitWishlist';

function toShape(item) {
  if (!item) return null;
  return {
    _id: item.itemId,
    itemId: item.itemId,
    userId: item.userId,
    name: item.name,
    price: item.price || null,
    url: item.url || '',
    photoUrl: item.photoUrl || '',
    currency: item.currency || 'USD',
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

async function createItem(userId, { name, price, url, photoUrl, currency }) {
  const ts = new Date().toISOString();
  const itemId = randomUUID();
  const item = { userId, itemId, name, price: price != null ? Number(price) : null, url: url || '', photoUrl: photoUrl || '', currency: currency || 'USD', createdAt: ts, updatedAt: ts };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return toShape(item);
}

async function updateItem(userId, itemId, updates) {
  const ts = new Date().toISOString();
  const expr = [];
  const attrValues = { ':ts': ts };
  const attrNames = {};

  if (updates.name !== undefined) { expr.push('#nm = :nm'); attrValues[':nm'] = updates.name; attrNames['#nm'] = 'name'; }
  if (updates.price !== undefined) { expr.push('#pr = :pr'); attrValues[':pr'] = updates.price != null ? Number(updates.price) : null; attrNames['#pr'] = 'price'; }
  if (updates.url !== undefined) { expr.push('#ur = :ur'); attrValues[':ur'] = updates.url || ''; attrNames['#ur'] = 'url'; }
  if (updates.photoUrl !== undefined) { expr.push('#ph = :ph'); attrValues[':ph'] = updates.photoUrl || ''; attrNames['#ph'] = 'photoUrl'; }
  if (updates.currency !== undefined) { expr.push('#cu = :cu'); attrValues[':cu'] = updates.currency || 'USD'; attrNames['#cu'] = 'currency'; }
  expr.push('#up = :ts');
  attrNames['#up'] = 'updatedAt';

  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, itemId },
    UpdateExpression: `SET ${expr.join(', ')}`,
    ExpressionAttributeNames: attrNames,
    ExpressionAttributeValues: attrValues,
    ConditionExpression: 'attribute_exists(itemId)',
    ReturnValues: 'ALL_NEW',
  }));
  return toShape(res.Attributes);
}

async function deleteItem(userId, itemId) {
  try {
    await docClient.send(new DeleteCommand({
      TableName: TABLE,
      Key: { userId, itemId },
      ConditionExpression: 'attribute_exists(itemId)',
    }));
    return true;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}

module.exports = { getAll, createItem, updateItem, deleteItem };

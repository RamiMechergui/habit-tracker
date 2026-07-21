const { PutCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamodb');
const { randomUUID } = require('crypto');

const TABLE = 'HabitPlannedBooks';

function toShape(item) {
  if (!item) return null;
  return {
    bookId: item.bookId,
    userId: item.userId,
    bookName: item.bookName,
    author: item.author || '',
    addedAt: item.addedAt,
    photoUrl: item.photoUrl || '',
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
  } while (lastKey);
  items.sort((a, b) => (a.addedAt || '').localeCompare(b.addedAt || ''));
  return items.map(toShape);
}

async function createItem(userId, { bookName, author, photoUrl }) {
  const ts = new Date().toISOString();
  const bookId = randomUUID();
  const item = {
    userId,
    bookId,
    bookName,
    author: author || '',
    addedAt: new Date().toISOString().split('T')[0],
    photoUrl: photoUrl || '',
    createdAt: ts,
    updatedAt: ts,
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return toShape(item);
}

async function updateItem(userId, bookId, updates) {
  const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
  const ts = new Date().toISOString();
  const expr = [];
  const attr = { ':ts': ts };
  if (updates.bookName !== undefined) { expr.push('bookName = :bn'); attr[':bn'] = updates.bookName; }
  if (updates.author !== undefined) { expr.push('author = :au'); attr[':au'] = updates.author; }
  expr.push('updatedAt = :ts');
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, bookId },
    UpdateExpression: `SET ${expr.join(', ')}`,
    ExpressionAttributeValues: attr,
    ConditionExpression: 'attribute_exists(bookId)',
    ReturnValues: 'ALL_NEW',
  }));
  return toShape(res.Attributes);
}

async function updatePhoto(userId, bookId, photoUrl) {
  const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
  const ts = new Date().toISOString();
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, bookId },
    UpdateExpression: 'SET photoUrl = :ph, updatedAt = :ts',
    ExpressionAttributeValues: { ':ph': photoUrl, ':ts': ts },
    ConditionExpression: 'attribute_exists(bookId)',
    ReturnValues: 'ALL_NEW',
  }));
  return toShape(res.Attributes);
}

async function deleteItem(userId, bookId) {
  try {
    await docClient.send(new DeleteCommand({
      TableName: TABLE,
      Key: { userId, bookId },
      ConditionExpression: 'attribute_exists(bookId)',
    }));
    return true;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}

module.exports = { getAll, createItem, updateItem, updatePhoto, deleteItem };

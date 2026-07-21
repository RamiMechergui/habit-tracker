const { PutCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamodb');
const { randomUUID } = require('crypto');

const TABLE = 'HabitArchivedBooks';

function toShape(item) {
  if (!item) return null;
  return {
    bookId: item.bookId,
    userId: item.userId,
    bookName: item.bookName,
    author: item.author || '',
    targetPages: item.targetPages,
    startDate: item.startDate,
    completionDate: item.completionDate,
    finalPage: item.finalPage,
    status: item.status,
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
  items.sort((a, b) => (b.completionDate || '').localeCompare(a.completionDate || ''));
  return items.map(toShape);
}

async function createItem(userId, bookData) {
  const ts = new Date().toISOString();
  const bookId = randomUUID();
  const item = {
    userId,
    bookId,
    bookName: bookData.bookName,
    author: bookData.author || '',
    targetPages: bookData.targetPages,
    startDate: bookData.startDate,
    completionDate: bookData.completionDate,
    finalPage: bookData.finalPage || 0,
    status: bookData.status || 'completed',
    photoUrl: bookData.photoUrl || '',
    createdAt: ts,
    updatedAt: ts,
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return toShape(item);
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

module.exports = { getAll, createItem, deleteItem };

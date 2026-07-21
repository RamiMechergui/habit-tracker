const { v4: uuidv4 } = require('uuid');
const {
  GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamodb');

const TABLE = 'HabitAvatarHistory';

function now() {
  return new Date().toISOString();
}

function toShape(item) {
  if (!item) return null;
  return {
    versionId:      item.versionId,
    versionNumber:  item.versionNumber,
    objectKey:      item.objectKey,
    mimetype:       item.mimetype,
    fileSize:       item.fileSize || 0,
    isCurrent:      !!item.isCurrent,
    createdAt:      item.createdAt,
  };
}

async function getNextVersionNumber(userId) {
  const res = await docClient.send(new QueryCommand({
    TableName:                 TABLE,
    IndexName:                 'UserIdVersionIndex',
    KeyConditionExpression:    'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    ScanIndexForward:          false,
    Limit:                     1,
  }));
  if (!res.Items || res.Items.length === 0) return 1;
  return (res.Items[0].versionNumber || 0) + 1;
}

async function createVersion(userId, objectKey, mimetype, fileSize) {
  const versionId = uuidv4();
  const versionNumber = await getNextVersionNumber(userId);
  const ts = now();
  const item = {
    userId,
    versionId,
    versionNumber,
    objectKey,
    mimetype,
    fileSize,
    isCurrent: false,
    createdAt: ts,
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return toShape(item);
}

async function getHistoryByUser(userId) {
  const res = await docClient.send(new QueryCommand({
    TableName:                 TABLE,
    IndexName:                 'UserIdVersionIndex',
    KeyConditionExpression:    'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    ScanIndexForward:          false,
  }));
  return (res.Items || []).map(toShape);
}

async function getVersionById(userId, versionId) {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { userId, versionId },
  }));
  return toShape(res.Item || null);
}

async function setCurrentVersion(userId, versionId) {
  const ts = now();
  await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, versionId: versionId },
    UpdateExpression: 'SET isCurrent = :true, updatedAt = :ts',
    ExpressionAttributeValues: { ':true': true, ':ts': ts },
  }));
}

async function unsetCurrentVersion(userId) {
  const current = await getCurrentVersion(userId);
  if (!current) return;
  await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, versionId: current.versionId },
    UpdateExpression: 'SET isCurrent = :false, updatedAt = :ts',
    ExpressionAttributeValues: { ':false': false, ':ts': now() },
  }));
}

async function getCurrentVersion(userId) {
  const res = await docClient.send(new QueryCommand({
    TableName:                 TABLE,
    IndexName:                 'UserIdVersionIndex',
    KeyConditionExpression:    'userId = :uid',
    FilterExpression:          'isCurrent = :true',
    ExpressionAttributeValues: { ':uid': userId, ':true': true },
    Limit: 1,
  }));
  return toShape((res.Items || [])[0] || null);
}

async function deleteVersion(userId, versionId) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE,
    Key: { userId, versionId },
  }));
}

async function deleteAllVersions(userId) {
  const versions = await getHistoryByUser(userId);
  const deletePromises = versions.map(v =>
    docClient.send(new DeleteCommand({
      TableName: TABLE,
      Key: { userId, versionId: v.versionId },
    }))
  );
  await Promise.all(deletePromises);
}

module.exports = {
  createVersion,
  getHistoryByUser,
  getVersionById,
  setCurrentVersion,
  unsetCurrentVersion,
  getCurrentVersion,
  deleteVersion,
  deleteAllVersions,
  getNextVersionNumber,
};

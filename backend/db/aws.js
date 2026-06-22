const { docClient } = require('./dynamodb');
const {
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const TABLE = 'HabitAws';

async function getAllAwsRecords(userId) {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }));
  return res.Items || [];
}

async function addService(userId, { service, description, category, keyFeatures, pricing, notes }) {
  const recordId = `SERVICE#${uuidv4()}`;
  const item = {
    userId,
    recordId,
    type: 'service',
    service,
    description,
    category,
    keyFeatures,
    pricing,
    notes,
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateService(userId, recordId, updates) {
  const allowed = ['service', 'description', 'category', 'keyFeatures', 'pricing', 'notes'];
  const sets = [];
  const names = {};
  const values = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = updates[key];
    }
  }
  if (!sets.length) return null;
  sets.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();

  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

async function addCert(userId, { certification, provider, status, examDate, score, notes }) {
  const recordId = `CERT#${uuidv4()}`;
  const item = {
    userId,
    recordId,
    type: 'cert',
    certification,
    provider,
    status,
    examDate,
    score,
    notes,
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateCert(userId, recordId, updates) {
  const allowed = ['certification', 'provider', 'status', 'examDate', 'score', 'notes'];
  const sets = [];
  const names = {};
  const values = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = updates[key];
    }
  }
  if (!sets.length) return null;
  sets.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();

  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

async function saveNote(userId, date, { content, studyMinutes = 0, topicsCovered = [] }) {
  const recordId = `NOTE#${date}`;
  const item = {
    userId,
    recordId,
    type: 'note',
    date,
    content,
    studyMinutes,
    topicsCovered,
    updatedAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function getNoteByDate(userId, date) {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { userId, recordId: `NOTE#${date}` },
  }));
  return res.Item || null;
}

async function deleteAwsRecord(userId, recordId) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE,
    Key: { userId, recordId },
  }));
  return true;
}

module.exports = {
  getAllAwsRecords,
  addService,
  updateService,
  addCert,
  updateCert,
  saveNote,
  getNoteByDate,
  deleteAwsRecord,
};

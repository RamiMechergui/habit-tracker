const { docClient } = require('./dynamodb');
const {
  PutCommand, GetCommand, UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');

const TABLE = 'HabitGerman';
const LEVELS = ['A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','B2.3','C1.1','C1.2','C2.1','C2.2'];

function getNextLevel(current) {
  const idx = LEVELS.indexOf(current);
  if (idx === -1 || idx === LEVELS.length - 1) return null;
  return LEVELS[idx + 1];
}

async function getProgress(userId) {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { userId, recordId: 'PROGRESS#v1' },
  }));
  return res.Item || null;
}

async function initProgress(userId) {
  const now = new Date().toISOString();
  const item = {
    userId,
    recordId: 'PROGRESS#v1',
    type: 'progress',
    currentLevel: 'A1.1',
    levelsCompleted: [],
    completedAt: {},
    startedAt: { 'A1.1': now },
    createdAt: now,
    updatedAt: now,
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function getOrInitProgress(userId) {
  const existing = await getProgress(userId);
  if (existing) {
    if (!existing.startedAt) {
      const now = new Date().toISOString();
      const res = await docClient.send(new UpdateCommand({
        TableName: TABLE,
        Key: { userId, recordId: 'PROGRESS#v1' },
        UpdateExpression: 'SET startedAt = :startedAt, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':startedAt': { [existing.currentLevel || 'A1.1']: existing.createdAt || now },
          ':updatedAt': now,
        },
        ReturnValues: 'ALL_NEW',
      }));
      return res.Attributes;
    }
    return existing;
  }
  return initProgress(userId);
}

async function advanceLevel(userId) {
  const state = await getOrInitProgress(userId);
  const next = getNextLevel(state.currentLevel);
  if (!next) return state;
  const now = new Date().toISOString();
  const completed = [...(state.levelsCompleted || []), state.currentLevel];
  const completedAt = { ...(state.completedAt || {}), [state.currentLevel]: now };
  const startedAt = { ...(state.startedAt || {}), [next]: now };
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId: 'PROGRESS#v1' },
    UpdateExpression: 'SET currentLevel = :next, levelsCompleted = :completed, completedAt = :completedAt, startedAt = :startedAt, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':next': next,
      ':completed': completed,
      ':completedAt': completedAt,
      ':startedAt': startedAt,
      ':updatedAt': now,
    },
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

async function setCurrentLevel(userId, level) {
  if (!LEVELS.includes(level)) return null;
  const now = new Date().toISOString();
  const res = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, recordId: 'PROGRESS#v1' },
    UpdateExpression: 'SET currentLevel = :level, #sa.#lvl = :now, updatedAt = :updatedAt REMOVE #ca.#lvl',
    ExpressionAttributeNames: {
      '#sa': 'startedAt',
      '#ca': 'completedAt',
      '#lvl': level,
    },
    ExpressionAttributeValues: {
      ':level': level,
      ':now': now,
      ':updatedAt': now,
    },
    ReturnValues: 'ALL_NEW',
  }));
  return res.Attributes;
}

module.exports = {
  getOrInitProgress, advanceLevel, setCurrentLevel, LEVELS, getNextLevel,
};

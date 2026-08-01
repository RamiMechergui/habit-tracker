const { PutCommand, GetCommand, DeleteCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamodb');
const { randomUUID } = require('crypto');

const TABLE = 'HabitSessions';

/**
 * Parse User-Agent into device, OS, browser, and detect the specific device model.
 */
function parseUA(ua) {
  if (!ua) return { device: 'Desktop', os: 'Unknown', browser: 'Unknown', deviceModel: '' };
  const s = ua;

  let device = 'Desktop';
  const isMobile = /\b(Mobile|iPhone|iPod|Windows Phone)\b/i.test(s);
  const isTablet = /\b(iPad|Tablet|Kindle|PlayBook|Silk)\b/i.test(s) ||
    (/\bAndroid\b/i.test(s) && !/\bMobile\b/i.test(s));
  if (isMobile) device = 'Mobile';
  else if (isTablet) device = 'Tablet';

  let os = 'Unknown';
  // Windows version
  const winMatch = s.match(/Windows NT (\d+\.?\d*)/);
  if (winMatch) {
    const v = parseFloat(winMatch[1]);
    if (v >= 10) os = 'Windows 11';
    else if (v >= 6.2) os = 'Windows 10';
    else if (v >= 6.1) os = 'Windows 7';
    else os = 'Windows';
  } else if (/Mac OS X (\d+[._]\d+)/.test(s)) {
    os = 'macOS';
  } else if (/Android (\d+[.]?\d*)/.test(s)) {
    os = `Android ${s.match(/Android (\d+[.]?\d*)/)[1]}`;
  } else if (/iPhone OS (\d+[._]\d+)/.test(s)) {
    os = `iOS ${s.match(/iPhone OS (\d+)[._](\d+)/).slice(1).join('.')}`;
  } else if (/iPad/.test(s)) os = 'iPadOS';
  else if (/Linux/.test(s) && !/Android/.test(s)) os = 'Linux';

  let browser = 'Unknown';
  if (/Firefox\/(\d+)/.test(s)) browser = 'Firefox';
  else if (/Edg\/(\d+)/.test(s)) browser = 'Edge';
  else if (/Chrome\/(\d+)/.test(s)) browser = 'Chrome';
  else if (/Safari/.test(s) && !/Chrome/.test(s)) browser = 'Safari';
  else if (/OPR\//.test(s)) browser = 'Opera';

  // Detect specific device model
  let deviceModel = '';
  // iPhone: "iPhone15,2" or "iPhone 15 Pro Max" via CFNetwork
  const iphoneMatch = s.match(/iPhone(\d+),(\d+)/);
  if (iphoneMatch) {
    const modelNum = parseInt(iphoneMatch[1]);
    const modelMap = {
      17: 'iPhone 17', 16: 'iPhone 16', 15: 'iPhone 15', 14: 'iPhone 14',
      13: 'iPhone 13', 12: 'iPhone 12', 11: 'iPhone 11',
    };
    deviceModel = modelMap[modelNum] || `iPhone (${iphoneMatch[0]})`;
  }
  // iPad
  if (!deviceModel && /iPad\d+,\d+/.test(s)) {
    deviceModel = 'iPad';
  }
  // Samsung Galaxy
  const samsungMatch = s.match(/SM-[A-Z]\d+\w*/i);
  if (samsungMatch) {
    const models = {
      'SM-S938': 'Galaxy S25 Ultra', 'SM-S937': 'Galaxy S25+', 'SM-S936': 'Galaxy S25',
      'SM-S928': 'Galaxy S24 Ultra', 'SM-S926': 'Galaxy S24', 'SM-S921': 'Galaxy S24',
      'SM-S918': 'Galaxy S23 Ultra', 'SM-S916': 'Galaxy S23+', 'SM-S911': 'Galaxy S23',
      'SM-S908': 'Galaxy S22 Ultra', 'SM-S906': 'Galaxy S22+', 'SM-S901': 'Galaxy S22',
    };
    const code = samsungMatch[0].toUpperCase().slice(0, 7);
    deviceModel = models[code] || samsungMatch[0];
  }
  // Pixel
  const pixelMatch = s.match(/Pixel (\d+[a-zA-Z]*)/i);
  if (pixelMatch) deviceModel = `Pixel ${pixelMatch[1]}`;
  // OnePlus
  const oneplusMatch = s.match(/OnePlus\s*(\d+)/i);
  if (oneplusMatch) deviceModel = `OnePlus ${oneplusMatch[1]}`;
  // Huawei
  const huaweiMatch = s.match(/HUAWEI\s*([A-Za-z0-9-]+)/i);
  if (huaweiMatch) deviceModel = `Huawei ${huaweiMatch[1]}`;
  // Xiaomi / Redmi
  const xiaomiMatch = s.match(/(?:Xiaomi|Redmi)\s*([A-Za-z0-9]+)/i);
  if (xiaomiMatch) deviceModel = `${xiaomiMatch[0]}`;

  return { device, os, browser, deviceModel };
}

function toShape(item) {
  if (!item) return null;
  return {
    sessionId: item.sessionId,
    userId: item.userId,
    deviceName: item.deviceName || '',
    os: item.os || '',
    browser: item.browser || '',
    deviceModel: item.deviceModel || '',
    ipAddress: item.ipAddress || '',
    locationEstimate: item.locationEstimate || '',
    connected: item.connected !== undefined ? item.connected : true,
    connectedAt: item.connectedAt || item.createdAt,
    disconnectedAt: item.disconnectedAt || null,
    lastActiveAt: item.lastActiveAt || item.createdAt,
    createdAt: item.createdAt,
    isRevoked: item.isRevoked || false,
    revokedAt: item.revokedAt || null,
  };
}

async function createSession(userId, { ip, userAgent }) {
  const sessionId = randomUUID();
  const ts = new Date().toISOString();
  const { device, os, browser, deviceModel } = parseUA(userAgent);
  const item = {
    userId,
    sessionId,
    deviceName: `${os} · ${browser}`,
    os,
    browser,
    deviceModel,
    ipAddress: ip || 'Unknown',
    locationEstimate: '',
    connected: true,
    connectedAt: ts,
    lastActiveAt: ts,
    createdAt: ts,
    isRevoked: false,
    revokedAt: null,
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return toShape(item);
}

async function getSession(userId, sessionId) {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { userId, sessionId },
  }));
  return toShape(res.Item || null);
}

async function listActiveSessions(userId) {
  const items = [];
  let lastKey;
  do {
    const res = await docClient.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    }));
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items.filter(i => !i.isRevoked).map(toShape);
}

/**
 * List all sessions including revoked ones (for session history).
 */
async function listAllSessions(userId) {
  const items = [];
  let lastKey;
  do {
    const res = await docClient.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    }));
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items.map(toShape);
}

async function revokeSession(userId, sessionId) {
  const ts = new Date().toISOString();
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE,
      Key: { userId, sessionId },
      UpdateExpression: 'SET isRevoked = :r, revokedAt = :ts, connected = :c, disconnectedAt = :dts',
      ExpressionAttributeValues: { ':r': true, ':ts': ts, ':c': false, ':dts': ts },
      ConditionExpression: 'attribute_exists(sessionId)',
    }));
    return true;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}

async function revokeAllSessionsExcept(userId, keepSessionId) {
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

  const ts = new Date().toISOString();
  const toRevoke = items.filter(i => i.sessionId !== keepSessionId && !i.isRevoked);
  for (const item of toRevoke) {
    await docClient.send(new UpdateCommand({
      TableName: TABLE,
      Key: { userId: item.userId, sessionId: item.sessionId },
      UpdateExpression: 'SET isRevoked = :r, revokedAt = :ts, connected = :c, disconnectedAt = :dts',
      ExpressionAttributeValues: { ':r': true, ':ts': ts, ':c': false, ':dts': ts },
    }));
  }
  return toRevoke.length;
}

async function touchSession(userId, sessionId) {
  const ts = new Date().toISOString();
  await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, sessionId },
    UpdateExpression: 'SET lastActiveAt = :ts, connected = :c',
    ExpressionAttributeValues: { ':ts': ts, ':c': true },
    ConditionExpression: 'attribute_exists(sessionId)',
  })).catch(() => {});
}

/**
 * Mark a session as disconnected (used on logout or heartbeat timeout).
 */
async function disconnectSession(userId, sessionId) {
  const ts = new Date().toISOString();
  await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, sessionId },
    UpdateExpression: 'SET connected = :c, disconnectedAt = :ts',
    ExpressionAttributeValues: { ':c': false, ':ts': ts },
  })).catch(() => {});
}

async function cleanRevokedSessions(userId, olderThan) {
  const cutoff = new Date(Date.now() - olderThan).toISOString();
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

  for (const item of items) {
    if (item.isRevoked && item.revokedAt && item.revokedAt < cutoff) {
      await docClient.send(new DeleteCommand({
        TableName: TABLE,
        Key: { userId: item.userId, sessionId: item.sessionId },
      }));
    }
  }
}

async function getRevokedSessionsOlderThan(userId, ageMs) {
  const cutoff = new Date(Date.now() - ageMs).toISOString();
  const all = await listAllSessions(userId);
  return all.filter(s => s.isRevoked && s.revokedAt && s.revokedAt < cutoff);
}

async function deleteSessions(userId, sessionIds) {
  for (const sessionId of sessionIds) {
    await docClient.send(new DeleteCommand({
      TableName: TABLE,
      Key: { userId, sessionId },
    })).catch(() => {});
  }
}

module.exports = {
  createSession,
  getSession,
  listActiveSessions,
  listAllSessions,
  revokeSession,
  revokeAllSessionsExcept,
  touchSession,
  disconnectSession,
  cleanRevokedSessions,
  getRevokedSessionsOlderThan,
  deleteSessions,
  parseUA,
};

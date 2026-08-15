/**
 * db/settings.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Data Access Object for the HabitSettings table.
 *
 * Key schema:
 *   PK: userId (String) — single key, no sort key needed
 *
 * Settings has a 1:1 relationship with a user, so userId is sufficient.
 */

const { GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamodb');

const TABLE = 'HabitSettings';

const DEFAULTS = {
  theme:          'dark',
  recurringTasks: {},
  timelinePrefs:  { defaultDuration: 30, intervalGranularity: 30 },
  noteSections:   ['General', 'App Development'],
};

/**
 * Returns settings for a user, or defaults if not yet saved.
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getSettings(userId) {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { userId },
  }));
  const item = res.Item || {};
  return {
    userId:         userId,
    theme:          item.theme          || DEFAULTS.theme,
    recurringTasks: item.recurringTasks || DEFAULTS.recurringTasks,
    timelinePrefs:  item.timelinePrefs  || DEFAULTS.timelinePrefs,
    noteSections:   item.noteSections   || DEFAULTS.noteSections,
  };
}

/**
 * Creates or updates settings for a user (upsert).
 * Only provided fields are updated; existing fields are preserved.
 * @param {string} userId
 * @param {{ theme?: string, recurringTasks?: object, timelinePrefs?: object }} fields
 * @returns {Promise<object>}
 */
async function upsertSettings(userId, fields) {
  const validFields = ['theme', 'recurringTasks', 'timelinePrefs', 'noteSections'];
  const updates     = {};
  validFields.forEach(k => { if (fields[k] !== undefined) updates[k] = fields[k]; });

  if (Object.keys(updates).length === 0) {
    return getSettings(userId);
  }

  const keys = Object.keys(updates);
  const SetExpressions = keys.map((k, i) => `#f${i} = :v${i}`);
  const ExpressionAttributeNames  = {};
  const ExpressionAttributeValues = { ':uid': userId };
  keys.forEach((k, i) => {
    ExpressionAttributeNames[`#f${i}`]  = k;
    ExpressionAttributeValues[`:v${i}`] = updates[k];
  });

  await docClient.send(new UpdateCommand({
    TableName:                 TABLE,
    Key:                       { userId },
    UpdateExpression:          `SET ${SetExpressions.join(', ')}`,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  }));

  return getSettings(userId);
}

module.exports = { getSettings, upsertSettings };

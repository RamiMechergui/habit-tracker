/**
 * scripts/trim-user-history.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time maintenance script: caps the in-user history array to the latest
 * HISTORY_LIMIT entries for every user in HabitUsers.
 *
 * History grew unboundedly and pushed some user items past DynamoDB's 400 KB
 * size limit, which made updateUser() fail (e.g. Session History Cleanup).
 *
 * Run from the backend directory:
 *   node scripts/trim-user-history.js
 */
const { ScanCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../db/dynamodb');

const TABLE = 'HabitUsers';
const HISTORY_LIMIT = 100;

async function main() {
  const users = [];
  let lastKey;
  do {
    const res = await docClient.send(new ScanCommand({
      TableName: TABLE,
      ExclusiveStartKey: lastKey,
    }));
    users.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Checking ${users.length} user(s)...`);

  for (const item of users) {
    const size = Buffer.byteLength(JSON.stringify(item), 'utf8');
    const history = Array.isArray(item.history) ? item.history : [];
    const needTrim = history.length > HISTORY_LIMIT || size > 350 * 1024;

    console.log(
      `- ${item.email || item.userId}: ${history.length} entries, ${(size / 1024).toFixed(1)} KB` +
      (needTrim ? '  → TRIM' : '  → ok')
    );

    if (!needTrim) continue;

    const trimmed = history.slice(-HISTORY_LIMIT);
    const now = new Date().toISOString();

    // If the item is already oversized, replace the field in two steps
    // (REMOVE then SET) so DynamoDB never sees an over-limit result.
    if (size > 400 * 1024) {
      await docClient.send(new UpdateCommand({
        TableName: TABLE,
        Key: { userId: item.userId },
        UpdateExpression: 'REMOVE #h',
        ExpressionAttributeNames: { '#h': 'history' },
      }));
    }

    await docClient.send(new UpdateCommand({
      TableName: TABLE,
      Key: { userId: item.userId },
      UpdateExpression: 'SET #h = :h, updatedAt = :u',
      ExpressionAttributeNames: { '#h': 'history' },
      ExpressionAttributeValues: { ':h': trimmed, ':u': now },
    }));

    const after = await docClient.send(new GetCommand({
      TableName: TABLE,
      Key: { userId: item.userId },
    }));
    console.log(
      `  → ${after.Item.history.length} entries, ${(Buffer.byteLength(JSON.stringify(after.Item), 'utf8') / 1024).toFixed(1)} KB`
    );
  }

  console.log('Done.');
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});

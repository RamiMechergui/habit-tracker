/**
 * dump-user-data.js — bypasses dotenv entirely, connects directly to DynamoDB Local
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const fs = require('fs');
const path = require('path');

const EMAIL = process.argv[2];
if (!EMAIL) { console.error('Usage: node dump-user-data.js <email>'); process.exit(1); }

// Force DynamoDB Local — ignore any dotenv/dotenvx that might redirect to AWS
const ENDPOINT = process.env.FORCE_ENDPOINT || 'http://localhost:8000';
const REGION   = 'us-east-1';

const rawClient = new DynamoDBClient({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});
const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true },
  unmarshallOptions: { wrapNumbers: false },
});

async function queryAll(TableName, KeyConditionExpression, ExpressionAttributeValues, IndexName) {
  let items = [], LastEvaluatedKey;
  do {
    const params = {
      TableName, KeyConditionExpression, ExpressionAttributeValues,
      ...(IndexName && { IndexName }),
      ...(LastEvaluatedKey && { ExclusiveStartKey: LastEvaluatedKey }),
    };
    const resp = await docClient.send(new QueryCommand(params));
    items = items.concat(resp.Items || []);
    LastEvaluatedKey = resp.LastEvaluatedKey;
  } while (LastEvaluatedKey);
  return items;
}

async function main() {
  console.log(`\n🔍 Connecting to DynamoDB at: ${ENDPOINT}`);
  console.log(`🔍 Looking up user: ${EMAIL}\n`);

  let userRecord;
  try {
    const resp = await docClient.send(new QueryCommand({
      TableName: 'HabitUsers',
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': EMAIL },
    }));
    if (!resp.Items || resp.Items.length === 0) {
      console.error(`❌ No user found with email: ${EMAIL}\n`);
      process.exit(1);
    }
    userRecord = resp.Items[0];
    console.log('✅ User found:');
    console.log(JSON.stringify(userRecord, null, 2));
  } catch (err) {
    console.error(`\n❌ Query failed: ${err.message}\n`);
    process.exit(1);
  }

  const userId = userRecord.userId;
  console.log(`\n📦 UserId: ${userId}\n`);

  const TABLES = [
    'HabitLogs', 'HabitExpenses', 'HabitNotes', 'HabitCredentials',
    'HabitSettings', 'HabitGerman', 'HabitAws', 'HabitWishlist',
    'HabitSessions', 'HabitPlannedBooks', 'HabitArchivedBooks',
    'HabitMilestones', 'HabitSavings', 'HabitAvatarHistory',
  ];

  const allData = { user: userRecord };

  for (const tableName of TABLES) {
    try {
      const items = await queryAll(tableName, 'userId = :uid', { ':uid': userId });
      allData[tableName] = items;
      console.log(items.length > 0 ? `  ✅ ${tableName}: ${items.length} record(s)` : `  ○  ${tableName}: empty`);
    } catch (err) {
      console.log(`  ⚠️  ${tableName}: ${err.message}`);
      allData[tableName] = { error: err.message };
    }
  }

  const safeName = EMAIL.replace(/[@.]/g, '_');
  const outFile = `/home/ubuntu/user-backup-${safeName}.json`;
  fs.writeFileSync(outFile, JSON.stringify(allData, null, 2), 'utf8');
  console.log(`\n💾 Backup saved to: ${outFile}`);
  console.log('\n✅ Done!\n');
}

main().catch(err => { console.error('\n💥', err.message); process.exit(1); });

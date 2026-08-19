/**
 * find-user.js — scans HabitUsers and finds user by email, then dumps all data
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const fs = require('fs');

const EMAIL = process.argv[2];
if (!EMAIL) { console.error('Usage: node find-user.js <email>'); process.exit(1); }

const rawClient = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});
const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true },
  unmarshallOptions: { wrapNumbers: false },
});

async function queryAll(TableName, KeyConditionExpression, ExpressionAttributeValues) {
  let items = [], LastEvaluatedKey;
  do {
    const resp = await docClient.send(new QueryCommand({
      TableName, KeyConditionExpression, ExpressionAttributeValues,
      ...(LastEvaluatedKey && { ExclusiveStartKey: LastEvaluatedKey }),
    }));
    items = items.concat(resp.Items || []);
    LastEvaluatedKey = resp.LastEvaluatedKey;
  } while (LastEvaluatedKey);
  return items;
}

async function main() {
  console.log(`\n🔍 Scanning HabitUsers for email: ${EMAIL}\n`);

  // Scan all users and filter by email
  const scan = await docClient.send(new ScanCommand({ TableName: 'HabitUsers' }));
  console.log(`Total users in DB: ${scan.Count}`);
  scan.Items.forEach(u => console.log(`  - ${u.email} | userId: ${u.userId}`));

  const userRecord = scan.Items.find(u => u.email === EMAIL);
  if (!userRecord) {
    console.error(`\n❌ User ${EMAIL} not found in HabitUsers table.\n`);
    process.exit(1);
  }

  const userId = userRecord.userId;
  console.log(`\n✅ Found! userId = ${userId}`);
  console.log(JSON.stringify(userRecord, null, 2));

  const TABLES = [
    'HabitLogs', 'HabitExpenses', 'HabitNotes', 'HabitCredentials',
    'HabitSettings', 'HabitGerman', 'HabitAws', 'HabitWishlist',
    'HabitSessions', 'HabitPlannedBooks', 'HabitArchivedBooks',
    'HabitMilestones', 'HabitSavings', 'HabitAvatarHistory',
  ];

  const allData = { user: userRecord };
  console.log('\n📦 Fetching data from all tables:\n');

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
  console.log(`\n💾 Full backup saved to: ${outFile}`);
  console.log('✅ Done!\n');
}

main().catch(err => { console.error('\n💥', err.message); process.exit(1); });

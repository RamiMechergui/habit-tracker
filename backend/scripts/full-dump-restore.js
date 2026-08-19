/**
 * full-dump-restore.js
 * Uses the EXACT same db/dynamodb client module as the backend app.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { docClient, rawClient } = require('../db/dynamodb');
const { ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const fs = require('fs');
const path = require('path');

const TARGET_EMAIL = 'street.cherk@gmail.com';

async function queryAll(TableName, KeyConditionExpression, ExpressionAttributeValues) {
  let items = [];
  let LastEvaluatedKey;
  do {
    const params = {
      TableName,
      KeyConditionExpression,
      ExpressionAttributeValues,
      ...(LastEvaluatedKey && { ExclusiveStartKey: LastEvaluatedKey }),
    };
    const resp = await docClient.send(new QueryCommand(params));
    items = items.concat(resp.Items || []);
    LastEvaluatedKey = resp.LastEvaluatedKey;
  } while (LastEvaluatedKey);
  return items;
}

async function scanAll(TableName) {
  let items = [];
  let LastEvaluatedKey;
  do {
    const params = {
      TableName,
      ...(LastEvaluatedKey && { ExclusiveStartKey: LastEvaluatedKey }),
    };
    const resp = await docClient.send(new ScanCommand(params));
    items = items.concat(resp.Items || []);
    LastEvaluatedKey = resp.LastEvaluatedKey;
  } while (LastEvaluatedKey);
  return items;
}

async function run() {
  console.log('=== Checking Tables & User Data via app docClient ===');
  
  // 1. List all tables
  const tablesResp = await rawClient.send(new ListTablesCommand({}));
  console.log('Available DynamoDB Tables:', tablesResp.TableNames);

  // 2. Scan HabitUsers to find target user
  const allUsers = await scanAll('HabitUsers');
  console.log(`Found ${allUsers.length} total users in HabitUsers:`);
  allUsers.forEach(u => console.log(` - email: ${u.email}, userId: ${u.userId}, name: ${u.displayName || u.name || '(none)'}`));

  const user = allUsers.find(u => (u.email || '').toLowerCase() === TARGET_EMAIL.toLowerCase());
  if (!user) {
    console.log(`\n❌ User ${TARGET_EMAIL} not found in HabitUsers.`);
    return;
  }

  const userId = user.userId;
  console.log(`\n🎯 Target User Found! userId = ${userId}`);
  console.log(JSON.stringify(user, null, 2));

  // 3. Scan / Query every table for this userId
  const dumpData = {
    user,
    userId,
    extractedAt: new Date().toISOString(),
    tables: {}
  };

  for (const table of tablesResp.TableNames) {
    if (table === 'HabitUsers') continue;
    try {
      // Try query by userId first
      let items = [];
      try {
        items = await queryAll(table, 'userId = :uid', { ':uid': userId });
      } catch (qErr) {
        // If Query fails (e.g. key schema is different), fallback to Scan with filter
        const allItems = await scanAll(table);
        items = allItems.filter(item => item.userId === userId);
      }

      dumpData.tables[table] = items;
      console.log(`Table [${table}]: ${items.length} records found for ${userId}`);
      if (items.length > 0) {
        // show sample of what's inside
        console.log(`   Sample keys/dates:`, items.slice(0, 3).map(it => it.date || it.recordId || it.noteId || it.itemId || it._id || Object.keys(it).join(',')));
      }
    } catch (err) {
      console.error(`Error querying table ${table}:`, err.message);
      dumpData.tables[table] = { error: err.message };
    }
  }

  const outputPath = path.join(__dirname, '..', `user_dump_${TARGET_EMAIL.replace(/[@.]/g, '_')}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(dumpData, null, 2), 'utf8');
  console.log(`\n✅ Saved complete user data dump to: ${outputPath}`);
}

run().catch(err => {
  console.error('Fatal error:', err);
});

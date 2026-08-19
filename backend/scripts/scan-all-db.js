require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { docClient, rawClient } = require('../db/dynamodb');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { ListTablesCommand } = require('@aws-sdk/client-dynamodb');

async function scanAllTables() {
  const { TableNames } = await rawClient.send(new ListTablesCommand({}));
  for (const t of TableNames) {
    const res = await docClient.send(new ScanCommand({ TableName: t }));
    console.log(`=== ${t} (Total: ${res.Count || 0}) ===`);
    if (res.Items && res.Items.length > 0) {
      const userIds = [...new Set(res.Items.map(i => i.userId || i.email || i.id || 'no-uid'))];
      console.log('  UserIDs present:', userIds);
      console.log('  Sample item keys:', Object.keys(res.Items[0]));
    }
  }
}
scanAllTables().catch(console.error);

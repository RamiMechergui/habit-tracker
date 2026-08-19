// scan-users.js - Lists all users in HabitUsers table
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { docClient } = require('../db/dynamodb');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');

async function run() {
  const r = await docClient.send(new ScanCommand({
    TableName: 'HabitUsers',
    ProjectionExpression: 'userId, email, createdAt, displayName'
  }));
  console.log('Total users found:', r.Count);
  (r.Items || []).forEach(u => console.log(JSON.stringify(u)));
}
run().catch(console.error);

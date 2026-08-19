require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { docClient } = require('../db/dynamodb');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');

async function checkOtherUids() {
  const otherUids = [
    '048e11d7-d443-4ec5-8a8a-211f5de8416f',
    '91a44df7-2f89-498e-a7b0-16529c54a77d',
    '431179f6-9835-46c8-a3df-09c59dfd820f'
  ];

  for (const uid of otherUids) {
    console.log(`\n=== Checking UID ${uid} ===`);
    const creds = await docClient.send(new ScanCommand({
      TableName: 'HabitCredentials',
      FilterExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': uid }
    }));
    console.log('Credentials:', creds.Items.map(c => ({ service: c.serviceName, username: c.username })));

    const logs = await docClient.send(new ScanCommand({
      TableName: 'HabitLogs',
      FilterExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': uid }
    }));
    console.log('Logs dates:', logs.Items.map(l => l.date));

    const savings = await docClient.send(new ScanCommand({
      TableName: 'HabitSavings',
      FilterExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': uid }
    }));
    console.log('Savings notes:', savings.Items.map(s => s.note));
  }
}

checkOtherUids().catch(console.error);

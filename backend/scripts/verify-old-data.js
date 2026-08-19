require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { docClient } = require('../db/dynamodb');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');

async function checkDetails() {
  const OLD_UID = '2c65a27a-dd8a-4729-a3ea-168cff7e02df';
  
  const notes = await docClient.send(new ScanCommand({
    TableName: 'HabitNotes',
    FilterExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': OLD_UID },
    Limit: 5
  }));
  console.log('Sample Notes for', OLD_UID, ':');
  notes.Items.forEach(n => console.log(' - Date:', n.date, '| Content preview:', (n.content || '').slice(0, 100)));

  const logs = await docClient.send(new ScanCommand({
    TableName: 'HabitLogs',
    FilterExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': OLD_UID },
    Limit: 5
  }));
  console.log('\nSample HabitLogs for', OLD_UID, ':');
  logs.Items.forEach(l => console.log(' - Date:', l.date, '| Data keys:', Object.keys(l.data || {})));

  const savings = await docClient.send(new ScanCommand({
    TableName: 'HabitSavings',
    FilterExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': OLD_UID },
    Limit: 5
  }));
  console.log('\nSample Savings for', OLD_UID, ':');
  savings.Items.forEach(s => console.log(' - Date:', s.date, '| Amount:', s.amount, '| Note:', s.note));
}

checkDetails().catch(console.error);

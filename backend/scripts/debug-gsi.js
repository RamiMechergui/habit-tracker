require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { docClient, rawClient } = require('../db/dynamodb');
const { QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

async function testGsi() {
  const tbl = await rawClient.send(new DescribeTableCommand({ TableName: 'HabitUsers' }));
  console.log('HabitUsers Table GSIs:', JSON.stringify(tbl.Table.GlobalSecondaryIndexes, null, 2));

  console.log('\n--- Scan HabitUsers ---');
  const scan = await docClient.send(new ScanCommand({ TableName: 'HabitUsers' }));
  console.log('Users in scan:', scan.Items.map(u => ({ email: u.email, userId: u.userId })));

  console.log('\n--- Query EmailIndex for street.cherk@gmail.com ---');
  try {
    const q = await docClient.send(new QueryCommand({
      TableName: 'HabitUsers',
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': 'street.cherk@gmail.com' }
    }));
    console.log('Query result count:', q.Count, 'items:', q.Items);
  } catch (err) {
    console.error('EmailIndex Query error:', err.message);
  }
}

testGsi().catch(console.error);

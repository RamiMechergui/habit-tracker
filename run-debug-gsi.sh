#!/bin/bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 20
cd ~/habit-tracker/backend

cat > debug-gsi-temp.js << 'JSEOF'
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

async function main() {
  const client = new DynamoDBClient({
    endpoint: 'http://localhost:8000',
    region: 'us-east-1',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' }
  });
  const doc = DynamoDBDocumentClient.from(client);

  // Query via GSI
  const qRes = await doc.send(new QueryCommand({
    TableName: 'HabitUsers',
    IndexName: 'EmailIndex',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': 'street.cherk@gmail.com' },
    Limit: 1,
  }));
  console.log('GSI query result:', qRes.Items?.length || 0, 'items');
  if (qRes.Items?.length > 0) {
    console.log('Found via GSI:', JSON.stringify({ userId: qRes.Items[0].userId, email: qRes.Items[0].email }));
  }

  // Scan all items and check
  const sRes = await doc.send(new ScanCommand({ TableName: 'HabitUsers', FilterExpression: 'email = :email', ExpressionAttributeValues: { ':email': 'street.cherk@gmail.com' } }));
  console.log('Scan result:', sRes.Items?.length || 0, 'items');
  if (sRes.Items?.length > 0) {
    console.log('Found via Scan:', JSON.stringify({ userId: sRes.Items[0].userId, email: sRes.Items[0].email, pwLen: sRes.Items[0].passwordHash?.length }));
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
JSEOF

node debug-gsi-temp.js
rm -f debug-gsi-temp.js

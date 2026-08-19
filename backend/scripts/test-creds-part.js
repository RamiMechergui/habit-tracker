require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

async function testCreds() {
  const credVariations = [
    { name: 'with local/local', creds: { accessKeyId: 'local', secretAccessKey: 'local' } },
    { name: 'with dummy/dummy', creds: { accessKeyId: 'dummy', secretAccessKey: 'dummy' } },
    { name: 'with habit/habit', creds: { accessKeyId: 'habit', secretAccessKey: 'habit' } },
    { name: 'undefined creds', creds: undefined }
  ];

  for (const v of credVariations) {
    const raw = new DynamoDBClient({
      region: 'us-east-1',
      endpoint: 'http://localhost:8000',
      ...(v.creds ? { credentials: v.creds } : {})
    });
    const doc = DynamoDBDocumentClient.from(raw);
    try {
      const res = await doc.send(new ScanCommand({ TableName: 'HabitUsers' }));
      console.log(`\n=== Variation [${v.name}] (Total: ${res.Count}) ===`);
      res.Items.forEach(u => console.log(`   - ${u.email} (userId: ${u.userId})`));
    } catch (e) {
      console.log(`=== Variation [${v.name}] Error:`, e.message);
    }
  }
}

testCreds().catch(console.error);

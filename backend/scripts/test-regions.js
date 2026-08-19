const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const REGIONS = ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'local', 'ap-southeast-1'];

async function testRegions() {
  for (const reg of REGIONS) {
    const raw = new DynamoDBClient({
      region: reg,
      endpoint: 'http://localhost:8000',
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' }
    });
    const doc = DynamoDBDocumentClient.from(raw);
    try {
      const res = await doc.send(new ScanCommand({ TableName: 'HabitUsers' }));
      console.log(`\n=== Region [${reg}] (Total: ${res.Count}) ===`);
      res.Items.forEach(u => console.log(`   - ${u.email} (userId: ${u.userId})`));
    } catch (e) {
      console.log(`=== Region [${reg}] Error:`, e.message);
    }
  }
}

testRegions().catch(console.error);

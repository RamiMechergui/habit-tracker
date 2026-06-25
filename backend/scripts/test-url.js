const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

// Use URL object instead of string
const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: {
    protocol: 'http:',
    hostname: 'dynamodb-local',
    port: 8000,
    path: '/',
  },
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

(async () => {
  console.log('sending...');
  try {
    const r = await client.send(new ListTablesCommand({}));
    console.log('tables:', JSON.stringify(r.TableNames));
  } catch (e) {
    console.log('err:', e.name, e.message);
  }
  process.exit(0);
})();

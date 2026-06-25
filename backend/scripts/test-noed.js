process.env.AWS_EC2_METADATA_DISABLED = 'true';

const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://dynamodb-local:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  endpointDiscoveryEnabled: false,
  endpointCacheSize: 0,
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

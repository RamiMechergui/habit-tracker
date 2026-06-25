const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

// Hook into endpoint resolution
const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://127.0.0.1:8999',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  endpointProvider: (params, context) => {
    console.log('endpointProvider called with:', JSON.stringify(params));
    return { url: new URL('http://127.0.0.1:8999/') };
  },
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

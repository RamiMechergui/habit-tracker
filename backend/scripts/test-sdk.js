const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const https = require('https');

const handler = new NodeHttpHandler({
  requestTimeout: 5000,
  connectionTimeout: 5000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://dynamodb-local:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  requestHandler: handler,
});

(async () => {
  console.log('sending...');
  try {
    const r = await client.send(new ListTablesCommand({}));
    console.log('tables:', r.TableNames);
  } catch (e) {
    console.error('Error:', e.name, e.message);
  }
  process.exit(0);
})();

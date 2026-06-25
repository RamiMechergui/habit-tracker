process.env.AWS_EC2_METADATA_DISABLED = 'true';

const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const http = require('http');

// Custom agent with keepAlive: false
const agent = new http.Agent({ keepAlive: false });

const handler = new NodeHttpHandler({
  requestTimeout: 5000,
  connectionTimeout: 5000,
  httpAgent: agent,
  httpsAgent: agent,
});

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://dynamodb-local:8000',
  credentials: { accessKeyId: 'AKID', secretAccessKey: 'SECRET' },
  requestHandler: handler,
  maxAttempts: 1,
});

(async () => {
  console.log('sending...');
  try {
    const r = await client.send(new ListTablesCommand({}));
    console.log('tables:', JSON.stringify(r.TableNames));
  } catch (e) {
    console.log('err:', e.name, e.message, e.stack?.slice(0, 200));
  }
  process.exit(0);
})();

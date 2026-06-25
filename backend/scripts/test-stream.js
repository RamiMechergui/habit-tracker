// Test if we can disable Content-Length by using a stream body
const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const { PassThrough } = require('stream');

// Custom handler that strips Content-Length
const handler = NodeHttpHandler.create({
  requestTimeout: 10000,
  connectionTimeout: 5000,
});

// Wrap handler to remove Content-Length from headers
const origHandle = handler.handle.bind(handler);
handler.handle = async (request, options) => {
  // Don't strip Content-Length - let the SDK add it
  // But make the body a stream
  const bodyStr = request.body?.toString() || '';
  const stream = new PassThrough();
  stream.end(bodyStr);
  request.body = stream;
  return origHandle(request, options);
};

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://dynamodb-local:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  requestHandler: handler,
  endpointDiscoveryEnabled: false,
  maxAttempts: 1,
});

(async () => {
  console.log('sending...');
  try {
    const r = await client.send(new ListTablesCommand({}));
    console.log('tables:', r.TableNames);
  } catch (e) {
    console.log('err:', e.name, e.message);
  }
  process.exit(0);
})();

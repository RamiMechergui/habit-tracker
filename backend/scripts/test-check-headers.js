const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const rawClient = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://dynamodb-local:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  endpointDiscoveryEnabled: false,
  maxAttempts: 1,
});

// Strip Content-Length middleware
rawClient.middlewareStack.add(
  (next) => async (args) => {
    if (args.request && args.request.headers) {
      delete args.request.headers['content-length'];
      delete args.request.headers['Content-Length'];
    }
    return next(args);
  },
  { step: 'build', priority: 'low' }
);

// Intercept before sending
rawClient.middlewareStack.add(
  (next) => async (args) => {
    console.log('=== FINALIZED REQUEST ===');
    console.log('AUTH:', args.request.headers['authorization']);
    console.log('HOST:', args.request.headers['host']);
    console.log('CL:', args.request.headers['content-length']);
    console.log('CONNECTION:', args.request.headers['connection']);
    // Don't proceed - simulate success
    const { Readable } = require('stream');
    return { response: { statusCode: 200, headers: {}, body: Readable.from(JSON.stringify({ TableNames: [] })) } };
  },
  { step: 'finalizeRequest', priority: 'lowest' }
);

const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true, convertEmptyValues: false },
  unmarshallOptions: { wrapNumbers: false },
});

(async () => {
  try {
    const r = await docClient.send(new ListTablesCommand({}));
    console.log('OK:', JSON.stringify(r.TableNames));
  } catch (e) {
    console.log('ERR:', e.name, e.message);
  }
  process.exit(0);
})();

const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://dynamodb-local:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

// Add middleware at initialize stage 
client.middlewareStack.add(
  (next) => async (args) => {
    console.log('INITIALIZE (input keys):', Object.keys(args.input));
    return next(args);
  },
  { step: 'initialize', priority: 'high' }
);

// At serialize stage - don't touch request
client.middlewareStack.add(
  (next) => async (args) => {
    console.log('SERIALIZE, request exists:', !!args.request);
    return next(args);
  },
  { step: 'serialize', priority: 'low' }
);

// At build stage
client.middlewareStack.add(
  (next) => async (args) => {
    console.log('BUILD, request exists:', !!args.request, 'headers:', args.request ? Object.keys(args.request.headers) : 'n/a');
    return next(args);
  },
  { step: 'build', priority: 'high' }
);

// At finalizeRequest
client.middlewareStack.add(
  (next) => async (args) => {
    console.log('FINALIZE, headers:', args.request ? Object.keys(args.request.headers) : 'n/a');
    return next(args);
  },
  { step: 'finalizeRequest', priority: 'high' }
);

(async () => {
  console.log('sending...');
  try {
    const r = await client.send(new ListTablesCommand({}));
    console.log('tables:', r.TableNames);
  } catch (e) {
    console.log('err:', e.name, e.message.slice(0, 200));
  }
  process.exit(0);
})();

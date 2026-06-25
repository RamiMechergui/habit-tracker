// Replicate exactly what the SDK does, step by step
const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

// Add a middleware that logs the serialized HTTP request before signing
const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://dynamodb-local:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

// Monkey-patch the middleware stack to log
client.middlewareStack.add(
  (next, context) => async (args) => {
    console.log('=== PRE-FINALIZE REQUEST ===');
    console.log('method:', args.request.method);
    console.log('path:', args.request.path);
    console.log('headers:', JSON.stringify(args.request.headers, null, 2));
    console.log('body type:', typeof args.request.body, args.request.body?.constructor?.name);
    console.log('body length:', args.request.body?.length);
    console.log('=== END PRE-FINALIZE ===');
    return next(args);
  },
  { step: 'finalizeRequest', priority: 'low' }
);

(async () => {
  console.log('sending...');
  const r = await client.send(new ListTablesCommand({}));
  console.log('tables:', r.TableNames);
  process.exit(0);
})().catch(e => { console.log('err:', e.name, e.message, e.stack?.slice(0,200)); process.exit(1); });

const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://dynamodb-local:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

client.middlewareStack.add(
  (next, context) => async (args) => {
    console.log('=== FINALIZED REQUEST ===');
    console.log('Method:', args.request.method);
    console.log('Path:', args.request.path);
    console.log('Headers:');
    const hs = args.request.headers;
    for (const k of Object.keys(hs).sort()) {
      console.log(`  ${k}: ${String(hs[k]).slice(0, 150)}`);
    }
    const b = args.request.body;
    console.log('Body:', b?.toString() || '(none)');
    console.log('Body type:', b?.constructor?.name);
    
    // Don't actually send
    return {
      response: {
        statusCode: 200,
        headers: { 'content-type': 'application/x-amz-json-1.0' },
        body: JSON.stringify({ TableNames: ['INTERCEPTED'] }),
      }
    };
  },
  { step: 'finalizeRequest', priority: 'lowest' }
);

(async () => {
  console.log('sending...');
  try {
    const r = await client.send(new ListTablesCommand({}));
    console.log('Result:', JSON.stringify(r.TableNames));
  } catch (e) {
    console.log('Error:', e.name, e.message);
  }
  process.exit(0);
})();

process.env.AWS_EC2_METADATA_DISABLED = 'true';

// Test if credential resolution works
const { fromNodeProviderChain } = require('@aws-sdk/credential-providers');

(async () => {
  console.log('resolving creds...');
  try {
    const provider = fromNodeProviderChain({
      clientConfig: { region: 'us-east-1' }
    });
    const creds = await provider();
    console.log('creds resolved:', creds.accessKeyId);
  } catch (e) {
    console.log('creds error:', e.name, e.message);
  }
  
  // Now try the basic SDK
  const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
  const client = new DynamoDBClient({
    region: 'us-east-1',
    endpoint: 'http://dynamodb-local:8000',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  
  console.log('sending...');
  try {
    const r = await client.send(new ListTablesCommand({}));
    console.log('tables:', r.TableNames);
  } catch (e) {
    console.log('err:', e.name, e.message);
  }
  process.exit(0);
})().catch(e => { console.log('err:', e.name, e.message); process.exit(1); });

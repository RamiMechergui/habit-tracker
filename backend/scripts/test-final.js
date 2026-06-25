process.env.AWS_ACCESS_KEY_ID = 'local';
process.env.AWS_SECRET_ACCESS_KEY = 'local';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_DEFAULT_REGION = 'us-east-1';
process.env.AWS_EC2_METADATA_DISABLED = 'true';

const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  endpoint: 'http://dynamodb-local:8000',
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

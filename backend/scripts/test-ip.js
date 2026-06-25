const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://172.18.0.2:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});
(async () => {
  try {
    const r = await client.send(new ListTablesCommand({}));
    console.log('tables:', r.TableNames);
  } catch (e) {
    console.log('err:', e.name, e.message);
  }
  process.exit(0);
})();

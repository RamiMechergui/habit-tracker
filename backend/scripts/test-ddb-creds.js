const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://dynamodb-local:8000',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
  forcePathStyle: true,
});
(async () => {
  console.log('sending...');
  try {
    const r = await client.send(new ListTablesCommand({}));
    console.log('tables:', r.TableNames);
  } catch (e) {
    console.error('Error:', e.message, e.code);
  }
})();

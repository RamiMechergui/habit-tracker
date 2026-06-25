console.log('loading sdk...');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
console.log('sdk loaded');
const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://dynamodb-local:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});
console.log('client created');
client.send(new (require('@aws-sdk/client-dynamodb').ListTablesCommand)({}))
  .then(r => console.log('tables:', r.TableNames))
  .catch(e => console.log('error:', e.message));

const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://dynamodb-local:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  requestHandler: new (require('@smithy/node-http-handler').NodeHttpHandler)({
    requestTimeout: 5000,
    connectionTimeout: 5000,
  }),
});

client.send(new ListTablesCommand({}))
  .then(r => { console.log('tables:', JSON.stringify(r.TableNames)); process.exit(0); })
  .catch(e => { console.log('err:', e.name, e.message); process.exit(1); });

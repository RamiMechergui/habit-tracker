const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({ region: 'us-east-1', endpoint: 'http://dynamodb-local:8000', credentials: { accessKeyId: 'local', secretAccessKey: 'local' } });
console.log('client created, sending...');
client.config.logger = console;
client.send(new (require('@aws-sdk/client-dynamodb').ListTablesCommand)({}))
  .then(r => { console.log('tables:', JSON.stringify(r.TableNames)); process.exit(0); })
  .catch(e => { console.log('err:', e.name, e.message); process.exit(1); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 10000);

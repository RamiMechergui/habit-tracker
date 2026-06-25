const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({ region: 'us-east-1', endpoint: 'http://dynamodb-local:8000', credentials: { accessKeyId: 'local', secretAccessKey: 'local' } });
console.log('endpoint:', client.config.endpoint);
console.log('endpointProvider:', typeof client.config.endpointProvider);
console.log('region:', client.config.region);
console.log('requestHandler:', client.config.requestHandler?.constructor?.name);
process.exit(0);

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

async function testAwsCloud() {
  console.log('--- Testing AWS Cloud DynamoDB (IAM Role) ---');
  // No endpoint specified -> connects to real AWS DynamoDB
  const raw = new DynamoDBClient({ region: 'us-east-1' });
  const doc = DynamoDBDocumentClient.from(raw);

  const users = await doc.send(new ScanCommand({ TableName: 'HabitUsers' }));
  console.log('AWS Cloud DynamoDB HabitUsers count:', users.Count);
  users.Items.forEach(u => console.log('  - Email:', u.email, '| userId:', u.userId, '| name:', u.firstName, u.lastName));
}

testAwsCloud().catch(console.error);

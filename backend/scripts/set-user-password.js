require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { docClient } = require('../db/dynamodb');
const { UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const EMAIL = 'street.cherk@gmail.com';
const USER_ID = '2c65a27a-dd8a-4729-a3ea-168cff7e02df';
const NEW_PASSWORD = '19981118';

async function setPassword() {
  console.log(`Setting password for ${EMAIL} (${USER_ID})...`);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(NEW_PASSWORD, salt);

  await docClient.send(new UpdateCommand({
    TableName: 'HabitUsers',
    Key: { userId: USER_ID },
    UpdateExpression: 'SET passwordHash = :ph, email = :em, updatedAt = :ts',
    ExpressionAttributeValues: {
      ':ph': passwordHash,
      ':em': EMAIL,
      ':ts': new Date().toISOString()
    }
  }));

  console.log('✅ Password hash updated successfully in DynamoDB!');

  // Verify bcrypt check
  const u = await docClient.send(new GetCommand({
    TableName: 'HabitUsers',
    Key: { userId: USER_ID }
  }));
  const match = await bcrypt.compare(NEW_PASSWORD, u.Item.passwordHash);
  console.log(`✅ Verification check: bcrypt.compare("${NEW_PASSWORD}", hash) => ${match}`);
}

setPassword().catch(console.error);

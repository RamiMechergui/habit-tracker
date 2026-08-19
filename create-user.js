const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const { getUserByEmail, createUser } = require('./db/users');
const { docClient } = require('./db/dynamodb');
const { DeleteCommand } = require('@aws-sdk/lib-dynamodb');

async function main() {
  const email = 'street.cherk@gmail.com';
  const password = '19981118';

  const existing = await getUserByEmail(email);
  if (existing) {
    console.log('Deleting existing user:', existing.userId);
    await docClient.send(new DeleteCommand({
      TableName: 'HabitUsers',
      Key: { userId: existing.userId }
    }));
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = randomUUID();
  const user = await createUser({ userId, email, passwordHash, firstName: 'Rami', lastName: 'Mechergui' });
  console.log('Created user:', user.email, '/ userId:', user.userId);

  const verify = await bcrypt.compare(password, user.passwordHash);
  console.log('Password verify:', verify);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });

const bcrypt = require('bcryptjs');
const { createUser, getUserByEmail } = require('../db/users');

async function main() {
  const users = [
    { firstName: 'John', lastName: 'Doe', email: 'john.doe@test.com', password: 'Test123!' },
    { firstName: 'Test', lastName: 'User', email: 'test@gmail.com', password: '123456789' },
  ];
  for (const u of users) {
    const existing = await getUserByEmail(u.email);
    if (existing) {
      console.log(`User ${u.email} already exists`);
      continue;
    }
    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await createUser({ email: u.email, passwordHash, firstName: u.firstName, lastName: u.lastName });
    console.log(`Created user: ${user.email}`);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });

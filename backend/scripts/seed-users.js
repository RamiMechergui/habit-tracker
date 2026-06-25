const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getUserByEmail, createUser } = require('../db/users');

const SEED_USERS = [
  { firstName: 'John', lastName: 'Doe', email: 'john.doe@test.com', password: 'Test123!' },
  { firstName: 'Test', lastName: 'User', email: 'test@gmail.com', password: '123456789' },
  { firstName: '', lastName: '', email: 'test@test.com', password: '123456789' },
];

async function seedUsers() {
  for (const user of SEED_USERS) {
    try {
      const existing = await getUserByEmail(user.email);
      if (existing) {
        console.log(`[Seed] User ${user.email} already exists, skipping`);
        continue;
      }
      const passwordHash = await bcrypt.hash(user.password, 10);
      await createUser({
        userId: crypto.randomUUID(),
        email: user.email,
        passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      console.log(`[Seed] Created test user: ${user.email}`);
    } catch (err) {
      console.error(`[Seed] Failed to create ${user.email}:`, err.message);
    }
  }
}

module.exports = { seedUsers };

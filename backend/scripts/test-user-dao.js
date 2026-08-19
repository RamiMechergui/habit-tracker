require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getUserByEmail } = require('../db/users');

async function test() {
  const u = await getUserByEmail('street.cherk@gmail.com');
  if (!u) {
    console.log('❌ User street.cherk@gmail.com not found via getUserByEmail!');
  } else {
    console.log('✅ User street.cherk@gmail.com found successfully in backend!');
    console.log({
      email: u.email,
      userId: u.userId,
      _id: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      passwordHashPrefix: (u.passwordHash || '').substring(0, 15) + '...',
      createdAt: u.createdAt
    });
  }
}

test().catch(console.error);

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { getUserByEmail } = require('../db/users');

async function test() {
  const email = 'street.cherk@gmail.com';
  const password = '19981118';

  const user = await getUserByEmail(email);
  console.log('1. getUserByEmail:', user ? 'FOUND' : 'NOT FOUND');
  if (!user) return;

  console.log('2. user details:', {
    userId: user.userId,
    email: user.email,
    passwordHash: user.passwordHash
  });

  const match = await bcrypt.compare(password, user.passwordHash);
  console.log('3. bcrypt match with 19981118:', match);
}

test().catch(console.error);

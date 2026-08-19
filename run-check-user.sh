#!/bin/bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 20
cd ~/habit-tracker/backend

cat > check-user-temp.js << 'JSEOF'
const { getUserByEmail } = require('./db/users');

async function main() {
  const user = await getUserByEmail('street.cherk@gmail.com');
  if (user) {
    console.log('User found:', JSON.stringify({ userId: user.userId, email: user.email, passwordHash: user.passwordHash?.substring(0, 20) + '...' }, null, 2));
  } else {
    console.log('User NOT found');
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
JSEOF

node check-user-temp.js
rm -f check-user-temp.js

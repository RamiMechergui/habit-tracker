#!/bin/bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 20
cd ~/habit-tracker/backend

cat > debug-login-temp.js << 'JSEOF'
const bcrypt = require('bcryptjs');
const { getUserByEmail } = require('./db/users');

async function main() {
  const user = await getUserByEmail('street.cherk@gmail.com');
  if (!user) { console.log('No user'); return; }
  console.log('User email:', user.email);
  console.log('Hash:', user.passwordHash);
  const result = await bcrypt.compare('19981118', user.passwordHash);
  console.log('Compare result:', result);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
JSEOF

node debug-login-temp.js
rm -f debug-login-temp.js

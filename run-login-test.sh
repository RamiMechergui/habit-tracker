#!/bin/bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 20
cd ~/habit-tracker/backend

cat > login-test-temp.js << 'JSEOF'
const bcrypt = require('bcryptjs');
const { getUserByEmail } = require('./db/users');

async function main() {
  const user = await getUserByEmail('street.cherk@gmail.com');
  if (!user) { console.log('NO USER FOUND'); return; }
  console.log('Found user:', user.email);
  console.log('Hash:', user.passwordHash);
  
  const r1 = await bcrypt.compare('19981118', user.passwordHash);
  console.log('Compare 19981118:', r1);
  
  // Also scan all users
  const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
  const { docClient } = require('./db/dynamodb');
  const res = await docClient.send(new ScanCommand({ TableName: 'HabitUsers', ProjectionExpression: 'email, userId' }));
  console.log('All users:', JSON.stringify(res.Items.map(i => ({ email: i.email, userId: i.userId }))));
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
JSEOF

node login-test-temp.js
rm -f login-test-temp.js

#!/bin/bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 20

echo "=== Kill DynamoDB ==="
pkill -f DynamoDBLocal || true
sleep 2

echo "=== Kill backend ==="
pm2 stop habit-tracker-api || true
sleep 1

echo "=== Reset data ==="
rm -rf ~/dynamodb-data/*
mkdir -p ~/dynamodb-data

echo "=== Start DynamoDB ==="
cd ~/dynamodb-local
nohup /usr/lib/jvm/java-17-openjdk-amd64/bin/java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb -dbPath /home/ubuntu/dynamodb-data -port 8000 > ~/logs/dynamodb.log 2>&1 &
sleep 4
echo "DynamoDB PID: $(pgrep -f DynamoDBLocal)"

echo "=== Verify DynamoDB is up ==="
curl -s -X POST http://localhost:8000 -H "Content-Type: application/x-amz-json-1.0" -H "X-Amz-Target: DynamoDB_20120810.ListTables" -H "Authorization: AWS4-HMAC-SHA256 Credential=local/20260818/us-east-1/dynamodb/aws4_request, SignedHeaders=host, Signature=dummy" -d '{}'
echo ""

echo "=== Start backend ==="
cd ~/habit-tracker
pm2 start ecosystem.config.js --env production
sleep 5

echo "=== Backend logs ==="
pm2 logs --nostream --lines 10

echo "=== Create user ==="
cd ~/habit-tracker/backend

cat > create-user-temp.js << 'JSEOF'
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const { getUserByEmail, createUser } = require('./db/users');

async function main() {
  const email = 'street.cherk@gmail.com';
  const password = '19981118';
  const existing = await getUserByEmail(email);
  if (existing) {
    console.log('User already exists:', existing.email, existing.userId);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const userId = randomUUID();
  const user = await createUser({ userId, email, passwordHash, firstName: 'Rami', lastName: 'Mechergui' });
  console.log('Created user:', user.email, '/ userId:', user.userId);
  const verify = await bcrypt.compare(password, user.passwordHash);
  console.log('Password verify:', verify);
}
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
JSEOF

node create-user-temp.js
rm -f create-user-temp.js

echo "=== Test login ==="
node -e "
const http = require('http');
const data = JSON.stringify({ email: 'street.cherk@gmail.com', password: '19981118' });
const req = http.request({ hostname: '127.0.0.1', port: 5001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => { let b=''; res.on('data',(c)=>b+=c); res.on('end',()=>console.log('Status:',res.statusCode,'Body:',b)); });
req.on('error',(e)=>console.error('Error:',e.message));
req.write(data); req.end();
"

echo "=== DynamoDB data file size ==="
ls -la ~/dynamodb-data/
echo "=== DONE ==="

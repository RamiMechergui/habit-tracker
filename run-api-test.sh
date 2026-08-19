#!/bin/bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 20
cd ~/habit-tracker/backend

cat > api-test-temp.js << 'JSEOF'
const http = require('http');

const data = JSON.stringify({ email: 'street.cherk@gmail.com', password: '19981118' });

const options = {
  hostname: '127.0.0.1',
  port: 5001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();
JSEOF

node api-test-temp.js
rm -f api-test-temp.js

#!/bin/bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 20

cd ~/habit-tracker
git pull origin main

cd backend
npm install --omit=dev 2>&1 | tail -3

cd ~/habit-tracker
pm2 restart habit-tracker-api --update-env
sleep 3

# Test login
node -e "
const http = require('http');
const data = JSON.stringify({ email: 'street.cherk@gmail.com', password: '19981118' });
const req = http.request({ hostname: '127.0.0.1', port: 5001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, (res) => { let b=''; res.on('data',(c)=>b+=c); res.on('end',()=>console.log('Status:',res.statusCode,'Body:',b)); });
req.on('error',(e)=>console.error('Error:',e.message));
req.write(data); req.end();
"
sleep 1
echo "=== Backend logs ==="
pm2 logs --nostream --lines 10

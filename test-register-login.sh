#!/bin/bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 20

echo "=== Register via API ==="
cd ~/habit-tracker/backend
node -e "
const http = require('http');
const data = JSON.stringify({ firstName: 'Rami', lastName: 'Mechergui', email: 'street.cherk@gmail.com', password: '19981118', confirmPassword: '19981118' });
const req = http.request({ hostname: '127.0.0.1', port: 5001, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => { let b=''; res.on('data',(c)=>b+=c); res.on('end',()=>{ console.log('Register:', res.statusCode, b); }); });
req.on('error',(e)=>console.error('Error:',e.message));
req.write(data); req.end();
"

sleep 2

echo "=== Login via API ==="
node -e "
const http = require('http');
const data = JSON.stringify({ email: 'street.cherk@gmail.com', password: '19981118' });
const req = http.request({ hostname: '127.0.0.1', port: 5001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => { let b=''; res.on('data',(c)=>b+=c); res.on('end',()=>{ console.log('Login:', res.statusCode, b); }); });
req.on('error',(e)=>console.error('Error:',e.message));
req.write(data); req.end();
"

echo "=== Server logs ==="
pm2 logs --nostream --lines 10

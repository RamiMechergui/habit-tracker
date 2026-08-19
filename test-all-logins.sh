#!/bin/bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 20

node -e "
const http = require('http');

function login(email, password) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ email, password });
    const req = http.request({ hostname: '127.0.0.1', port: 5001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => { let b=''; res.on('data',(c)=>b+=c); res.on('end',()=>resolve({status:res.statusCode, body:b})); });
    req.on('error',(e)=>resolve({error:e.message}));
    req.write(data); req.end();
  });
}

(async () => {
  console.log('john.doe@test.com / Test123!:', JSON.stringify(await login('john.doe@test.com', 'Test123!')));
  console.log('test@gmail.com / 123456789:', JSON.stringify(await login('test@gmail.com', '123456789')));
  console.log('street.cherk@gmail.com / 19981118:', JSON.stringify(await login('street.cherk@gmail.com', '19981118')));
})();
"

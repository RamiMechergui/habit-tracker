const http = require('http');
const opts = { hostname: 'dynamodb-local', port: 8000, path: '/', method: 'POST',
  headers: { 'Content-Type': 'application/x-amz-json-1.0', 'X-Amz-Target': 'DynamoDB_20120810.ListTables' },
  timeout: 5000,
};
console.log('sending...');
const req = http.request(opts, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => { console.log('status:', res.statusCode, 'body:', body.slice(0,300)); process.exit(0); });
});
req.on('error', e => { console.log('err:', e.message); process.exit(1); });
req.on('timeout', () => { console.log('timeout!'); req.destroy(); process.exit(1); });
req.end();

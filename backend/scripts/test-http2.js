const http = require('http');
const data = JSON.stringify({
  TableNames: [],
  Limit: 10
});
const req = http.request('http://dynamodb-local:8000/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-amz-json-1.0',
    'X-Amz-Target': 'DynamoDB_20120810.ListTables',
    'Content-Length': Buffer.byteLength(data),
  },
  timeout: 5000,
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('status:', res.statusCode);
    console.log('body:', body.slice(0, 500));
    process.exit(0);
  });
});
req.on('error', e => { console.log('err:', e.message); process.exit(1); });
req.on('timeout', () => { console.log('timeout!'); req.destroy(); process.exit(1); });
req.write(data);
req.end();

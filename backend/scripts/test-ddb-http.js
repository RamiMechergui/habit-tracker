const http = require('http');
const data = JSON.stringify({});
const options = {
  hostname: 'dynamodb-local',
  port: 8000,
  path: '/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-amz-json-1.0',
    'X-Amz-Target': 'DynamoDB_20120810.ListTables',
    'Content-Length': data.length,
  },
};
const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => { console.log('Status:', res.statusCode); console.log('Body:', body); });
});
req.on('error', e => console.error('Error:', e.message));
req.write(data);
req.end();

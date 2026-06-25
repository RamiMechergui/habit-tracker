const http = require('http');
const { SignatureV4 } = require('@smithy/signature-v4');
const { Sha256 } = require('@aws-crypto/sha256-js');

(async () => {
  console.log('signing...');
  const signer = new SignatureV4({
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    region: 'us-east-1', service: 'dynamodb', sha256: Sha256,
  });
  const signed = await signer.sign({
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': 'DynamoDB_20120810.ListTables',
      'Host': 'dynamodb-local:8000',
    },
    body: '{}',
    hostname: 'dynamodb-local', port: 8000, path: '/', protocol: 'http:',
  });
  // Print each header with its value
  for (const [k, v] of Object.entries(signed.headers)) {
    console.log(`  ${k}: ${v}`);
  }
  
  // Try WITHOUT auth header to isolate the issue
  delete signed.headers['authorization'];
  delete signed.headers['Authorization'];
  
  const req = http.request({
    hostname: 'dynamodb-local', port: 8000, path: '/', method: 'POST',
    headers: signed.headers,
    timeout: 5000,
  }, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      console.log('status:', res.statusCode, 'body:', body.slice(0, 500));
      process.exit(0);
    });
  });
  req.on('error', e => { console.log('err:', e.message); process.exit(1); });
  req.on('timeout', () => { console.log('timeout!'); req.destroy(); process.exit(1); });
  req.write('{}');
  req.end();
})();

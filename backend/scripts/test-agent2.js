const http = require('http');
const { SignatureV4 } = require('@smithy/signature-v4');
const { Sha256 } = require('@aws-crypto/sha256-js');

(async () => {
  const signer = new SignatureV4({
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    region: 'us-east-1', service: 'dynamodb', sha256: Sha256,
  });
  const body = '{}';
  const signed = await signer.sign({
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': 'DynamoDB_20120810.ListTables',
      'Host': 'dynamodb-local:8000',
    },
    body,
    hostname: 'dynamodb-local', port: 8000, path: '/', protocol: 'http:',
  });
  console.log('signed');
  
  const req = http.request({
    hostname: 'dynamodb-local', port: 8000, path: '/', method: 'POST',
    headers: signed.headers,
    agent: false,  // no connection pooling
    timeout: 10000,
  }, (res) => {
    let b = '';
    res.on('data', c => b += c);
    res.on('end', () => {
      console.log('status:', res.statusCode, 'body:', b.slice(0, 300));
      process.exit(0);
    });
  });
  req.on('error', e => { console.log('err:', e.message); process.exit(1); });
  req.on('timeout', () => { console.log('timeout!'); req.destroy(); process.exit(1); });
  req.end(body);
})();

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
  console.log('signed, creating request...');
  
  const req = http.request({
    hostname: 'dynamodb-local', port: 8000, path: '/', method: 'POST',
    headers: signed.headers,
  });
  
  req.on('socket', (sock) => {
    console.log('socket event');
    sock.on('connect', () => console.log('socket connected'));
    sock.on('lookup', (e, a, t) => console.log('lookup:', a, t));
    sock.on('ready', () => console.log('socket ready'));
    sock.on('close', () => console.log('socket closed'));
    sock.on('data', (d) => console.log('socket data:', d.length, 'bytes'));
    sock.on('drain', () => console.log('socket drain'));
    sock.on('end', () => console.log('socket end'));
    sock.on('timeout', () => console.log('socket timeout'));
  });
  
  req.on('response', (res) => {
    console.log('response event: status', res.statusCode);
    let b = '';
    res.on('data', c => b += c);
    res.on('end', () => { console.log('body:', b.slice(0,300)); process.exit(0); });
  });
  req.on('error', e => { console.log('error event:', e.message); process.exit(1); });
  req.on('upgrade', () => console.log('upgrade'));
  req.on('connect', () => console.log('connect'));
  req.on('abort', () => console.log('abort'));
  req.on('close', () => console.log('req close'));
  req.on('finish', () => console.log('req finish'));
  
  console.log('ending request...');
  req.end(body);
  console.log('after end');
  
  setTimeout(() => { console.log('timeout!'); process.exit(1); }, 15000);
})();

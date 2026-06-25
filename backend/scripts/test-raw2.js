const http = require('http');
const { SignatureV4 } = require('@smithy/signature-v4');
const { Sha256 } = require('@aws-crypto/sha256-js');
const { Writable } = require('stream');

(async () => {
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

  // Remove Host from signed headers to let Node.js set it
  // But keep everything else
  const hs = { ...signed.headers };
  delete hs.Host;
  
  // Build request line
  const bodyBuf = Buffer.from('{}');
  const headerLines = [
    'POST / HTTP/1.1',
    'Host: dynamodb-local:8000',
  ];
  for (const [k, v] of Object.entries(hs)) {
    headerLines.push(`${k}: ${v}`);
  }
  const requestPreview = headerLines.join('\r\n') + '\r\n\r\n' + bodyBuf.toString();
  console.log('=== REQUEST PREVIEW ===');
  console.log(requestPreview.slice(0, 1000));
  console.log('=== END PREVIEW ===');
  
  // Send with raw TCP
  const net = require('net');
  const sock = new net.Socket();
  console.log('connecting...');
  sock.connect(8000, 'dynamodb-local', () => {
    console.log('connected, sending...');
    sock.write('POST / HTTP/1.1\r\n');
    sock.write('Host: dynamodb-local:8000\r\n');
    for (const [k, v] of Object.entries(hs)) {
      sock.write(`${k}: ${v}\r\n`);
    }
    sock.write('\r\n');
    sock.write('{}');
  });
  let data = '';
  sock.on('data', chunk => { data += chunk.toString(); });
  sock.on('close', () => {
    console.log('=== RESPONSE ===');
    console.log(data.slice(0, 1000));
    console.log('=== END ===');
    process.exit(0);
  });
  sock.on('error', e => { console.log('err:', e.message); process.exit(1); });
  setTimeout(() => { console.log('timeout!'); process.exit(1); }, 8000);
})();

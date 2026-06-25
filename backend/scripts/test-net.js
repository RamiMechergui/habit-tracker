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
      'Content-Length': String(Buffer.byteLength(body)),
    },
    body,
    hostname: 'dynamodb-local', port: 8000, path: '/', protocol: 'http:',
  });
  console.log('signed');
  
  // Use raw net.Socket but pipe through HTTP parser
  const net = require('net');
  const httpParser = require('http').Client;
  
  console.log('creating socket...');
  const sock = new net.Socket();
  sock.connect(8000, 'dynamodb-local', () => {
    console.log('connected');
    // Send request manually
    let reqStr = 'POST / HTTP/1.1\r\n';
    for (const [k, v] of Object.entries(signed.headers)) {
      reqStr += `${k}: ${v}\r\n`;
    }
    reqStr += '\r\n';
    reqStr += body;
    sock.write(reqStr);
    console.log('request sent, waiting for response...');
  });
  
  let data = '';
  sock.on('data', chunk => {
    data += chunk.toString();
    console.log('got data:', chunk.length, 'bytes');
    // Check if we have complete headers
    if (data.includes('\r\n\r\n')) {
      const [headers, ...rest] = data.split('\r\n\r\n');
      console.log('=== RESPONSE HEADERS ===');
      console.log(headers.slice(0, 500));
      console.log('=== BODY START ===');
      console.log(rest.join('\r\n\r\n').slice(0, 300));
      console.log('=== END ===');
      process.exit(0);
    }
  });
  sock.on('close', () => {
    console.log('socket closed');
    if (data) console.log('partial data:', data.slice(0, 500));
    process.exit(1);
  });
  sock.on('error', e => { console.log('socket error:', e.message); process.exit(1); });
  setTimeout(() => { console.log('timeout!'); process.exit(1); }, 10000);
})();

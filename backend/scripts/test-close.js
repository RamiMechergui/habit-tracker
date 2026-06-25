const net = require('net');
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
  
  const sock = new net.Socket();
  sock.connect(8000, 'dynamodb-local', () => {
    let reqStr = 'POST / HTTP/1.1\r\n';
    for (const [k, v] of Object.entries(signed.headers)) {
      reqStr += `${k}: ${v}\r\n`;
    }
    reqStr += 'Connection: close\r\n';
    reqStr += '\r\n' + body;
    sock.write(reqStr);
    console.log('sent');
  });
  
  let data = '';
  sock.on('data', chunk => { data += chunk.toString(); });
  sock.on('close', () => {
    console.log('=== RESPONSE ===');
    console.log(data.slice(0, 1000));
    if (data.includes('InternalFailure')) {
      console.log('\n*** InternalFailure - credentials might be wrong ***');
    }
    process.exit(0);
  });
  sock.on('error', e => { console.log('err:', e.message); process.exit(1); });
  setTimeout(() => { console.log('timeout!'); process.exit(1); }, 10000);
})();

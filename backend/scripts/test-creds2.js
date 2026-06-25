const net = require('net');
const { SignatureV4 } = require('@smithy/signature-v4');
const { Sha256 } = require('@aws-crypto/sha256-js');

async function tryCredentials(akid, secret) {
  console.log(`\n--- Trying ${akid}/${secret} ---`);
  const signer = new SignatureV4({
    credentials: { accessKeyId: akid, secretAccessKey: secret },
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
  
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let data = '';
    sock.setTimeout(5000);
    sock.connect(8000, 'dynamodb-local', () => {
      let reqStr = 'POST / HTTP/1.1\r\n';
      for (const [k, v] of Object.entries(signed.headers)) {
        reqStr += `${k}: ${v}\r\n`;
      }
      reqStr += 'Connection: close\r\n\r\n' + body;
      sock.write(reqStr);
    });
    sock.on('data', chunk => { data += chunk.toString(); });
    sock.on('close', () => resolve(data));
    sock.on('timeout', () => { sock.destroy(); resolve(null); });
    sock.on('error', () => resolve(null));
  });
}

(async () => {
  const creds = [
    ['local', 'local'],
    ['AKID', 'SECRET'],
    ['AKIAIOSFODNN7EXAMPLE', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'],
    ['dummy', 'dummy'],
    ['accessKey1', 'secretKey1'],
  ];
  for (const [ak, sk] of creds) {
    const res = await tryCredentials(ak, sk);
    if (res) {
      const statusLine = res.split('\r\n')[0];
      const bodyStart = res.indexOf('{');
      const body = bodyStart >= 0 ? res.slice(bodyStart, bodyStart + 200) : '';
      console.log(`  ${ak}: ${statusLine} | ${body.slice(0, 100)}`);
    } else {
      console.log(`  ${ak}: TIMEOUT`);
    }
  }
  process.exit(0);
})();

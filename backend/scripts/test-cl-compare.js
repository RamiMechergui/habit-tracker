const net = require('net');

async function testWithContentLength(includeContentLength) {
  return new Promise((resolve) => {
    // Use the same headers the SDK generates (from the previous test)
    const headers = {
      "content-type": "application/x-amz-json-1.0",
      "x-amz-target": "DynamoDB_20120810.ListTables",
      "host": "dynamodb-local:8000",
      "x-amz-date": "20260625T012501Z",
      "x-amz-content-sha256": "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
      "authorization": "AWS4-HMAC-SHA256 Credential=local/20260625/us-east-1/dynamodb/aws4_request, SignedHeaders=amz-sdk-invocation-id;amz-sdk-request;content-length;content-type;host;x-amz-content-sha256;x-amz-date;x-amz-target;x-amz-user-agent, Signature=ee1677db718023d12c15321d4e55ac9fe16cbf62fc5c4bd2d9b64fad960182ff"
    };
    if (includeContentLength) {
      headers['content-length'] = '2';
    }
    
    const sock = new net.Socket();
    let data = '';
    sock.connect(8000, 'dynamodb-local', () => {
      let reqStr = 'POST / HTTP/1.1\r\n';
      for (const [k, v] of Object.entries(headers)) {
        reqStr += `${k}: ${v}\r\n`;
      }
      reqStr += 'Connection: close\r\n\r\n{}';
      sock.write(reqStr);
    });
    sock.on('data', chunk => { data += chunk.toString(); });
    sock.on('close', () => {
      const status = data.split('\r\n')[0];
      resolve(status);
    });
    sock.on('error', () => resolve('ERROR'));
    setTimeout(() => { sock.destroy(); resolve('TIMEOUT'); }, 5000);
  });
}

(async () => {
  console.log('Without Content-Length:', await testWithContentLength(false));
  console.log('With Content-Length:', await testWithContentLength(true));
  process.exit(0);
})();

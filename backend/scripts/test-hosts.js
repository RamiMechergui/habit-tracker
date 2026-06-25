const net = require('net');
const crypto = require('crypto');

function sha256(msg) {
  return crypto.createHash('sha256').update(msg).digest('hex');
}
function hmac(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

(async () => {
  const akid = 'local', secret = 'local', region = 'us-east-1', service = 'dynamodb';
  const method = 'POST', path = '/', body = '{}';
  
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dateStamp = now.toISOString().split('T')[0].replace(/-/g, '');
  const bodyHash = sha256(body);
  
  // Test with different Host values
  const hosts = ['dynamodb-local:8000', 'localhost:8000', '127.0.0.1:8000', 'dynamodb-local'];
  
  for (const host of hosts) {
    const headers = {
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': 'DynamoDB_20120810.ListTables',
      'Host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': bodyHash,
    };
    
    const headerMap = {};
    for (const [k, v] of Object.entries(headers)) headerMap[k.toLowerCase()] = v.trim();
    const signedHeaders = Object.keys(headerMap).sort();
    const canonicalHeaders = signedHeaders.map(h => `${h}:${headerMap[h]}\n`).join('');
    
    const canonicalRequest = [
      method, path, '',
      canonicalHeaders,
      signedHeaders.join(';'),
      bodyHash
    ].join('\n');
    
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256(canonicalRequest)
    ].join('\n');
    
    let kSecret = `AWS4${secret}`;
    let kDate = hmac(kSecret, dateStamp);
    let kRegion = hmac(kDate, region);
    let kService = hmac(kRegion, service);
    let kSigning = hmac(kService, 'aws4_request');
    const signature = hmac(kSigning, stringToSign).toString('hex');
    
    const authHeader = `AWS4-HMAC-SHA256 Credential=${akid}/${credentialScope}, SignedHeaders=${signedHeaders.join(';')}, Signature=${signature}`;
    
    const result = await new Promise((resolve) => {
      const sock = new net.Socket();
      let data = '';
      sock.connect(8000, 'dynamodb-local', () => {
        let reqStr = `POST ${path} HTTP/1.1\r\n`;
        for (const [k, v] of Object.entries(headers)) {
          reqStr += `${k}: ${v}\r\n`;
        }
        reqStr += `authorization: ${authHeader}\r\nConnection: close\r\n\r\n${body}`;
        sock.write(reqStr);
      });
      sock.on('data', chunk => { data += chunk.toString(); });
      sock.on('close', () => resolve(data));
      sock.on('error', () => resolve(null));
      setTimeout(() => { sock.destroy(); resolve(null); }, 5000);
    });
    
    const status = result ? result.split('\r\n')[0] : 'TIMEOUT';
    const bodyJson = result && result.includes('{') ? result.slice(result.indexOf('{'), result.indexOf('{') + 150) : '';
    console.log(`Host ${host}: ${status}`);
    if (bodyJson) console.log(`  ${bodyJson}`);
  }
  process.exit(0);
})();

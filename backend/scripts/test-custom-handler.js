const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const net = require('net');
const { Writable } = require('stream');
const { HttpResponse } = require('@smithy/protocol-http');

// Parse HTTP response from raw bytes
function parseHttpResponse(raw) {
  const idx = raw.indexOf('\r\n\r\n');
  if (idx === -1) return null;
  const head = raw.slice(0, idx);
  const body = raw.slice(idx + 4);
  const lines = head.split('\r\n');
  const statusLine = lines[0].split(' ');
  const statusCode = parseInt(statusLine[1], 10);
  const headers = {};
  for (let i = 1; i < lines.length; i++) {
    const [k, ...v] = lines[i].split(':');
    if (k) headers[k.toLowerCase()] = v.join(':').trim();
  }
  return { statusCode, headers, body };
}

// Custom HTTP handler using raw net.Socket
const customHandler = {
  destroy: () => {},
  handle: async (request, { abortSignal } = {}) => {
    console.log('CUSTOM HANDLER sending:', request.method, request.hostname + ':' + request.port + request.path);
    console.log('Custom handler headers:', JSON.stringify(request.headers));
    
    return new Promise((resolve, reject) => {
      const body = typeof request.body === 'string' ? request.body :
                   request.body ? request.body.toString() : '';
      
      const sock = new net.Socket();
      let rawResponse = '';
      let timeout;
      
      sock.connect(request.port || 80, request.hostname, () => {
        let reqStr = `${request.method} ${request.path} HTTP/1.1\r\n`;
        for (const [k, v] of Object.entries(request.headers)) {
          if (k.toLowerCase() !== 'content-length' && k.toLowerCase() !== 'transfer-encoding') {
            reqStr += `${k}: ${v}\r\n`;
          }
        }
        reqStr += 'Connection: close\r\n';
        reqStr += '\r\n' + body;
        sock.write(reqStr);
      });
      
      sock.on('data', chunk => { rawResponse += chunk.toString(); });
      sock.on('close', () => {
        clearTimeout(timeout);
        const parsed = parseHttpResponse(rawResponse);
        if (parsed) {
          // Create a readable stream for the body
          const { Readable } = require('stream');
          const bodyStream = new Readable();
          bodyStream.push(parsed.body);
          bodyStream.push(null);
          
          resolve({
            response: new HttpResponse({
              statusCode: parsed.statusCode,
              headers: parsed.headers,
              body: bodyStream,
            })
          });
        } else {
          reject(new Error('Failed to parse HTTP response'));
        }
      });
      sock.on('error', reject);
      timeout = setTimeout(() => { sock.destroy(); reject(new Error('Timeout')); }, 15000);
    });
  },
  updateHttpClientConfig: () => {},
  httpHandlerConfigs: () => ({}),
};

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://dynamodb-local:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  requestHandler: customHandler,
  endpointDiscoveryEnabled: false,
  maxAttempts: 1,
});

(async () => {
  console.log('sending...');
  try {
    const r = await client.send(new ListTablesCommand({}));
    console.log('tables:', JSON.stringify(r.TableNames));
  } catch (e) {
    console.log('err:', e.name, e.message);
    console.log('stack:', e.stack?.slice(0, 300));
  }
  process.exit(0);
})();

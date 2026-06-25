const net = require('net');

// Simple TCP server that logs what it receives
const server = net.createServer(sock => {
  let data = '';
  sock.on('data', chunk => data += chunk.toString());
  sock.on('end', () => {
    console.log('=== REQUEST ===');
    console.log(data.slice(0, 2000));
    console.log('=== END ===');
    sock.end('HTTP/1.1 200 OK\r\nContent-Type: application/x-amz-json-1.0\r\n\r\n{"TableNames":[]}');
  });
  sock.on('error', e => console.log('sock error:', e.message));
});

server.listen(8999, () => console.log('listening on 8999'));

// Now try to connect via SDK
const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://127.0.0.1:8999',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

setTimeout(async () => {
  try {
    console.log('sending SDK request...');
    const r = await client.send(new ListTablesCommand({}));
    console.log('tables:', JSON.stringify(r.TableNames));
  } catch (e) {
    console.log('err:', e.name, e.message);
  }
  server.close();
  process.exit(0);
}, 500);

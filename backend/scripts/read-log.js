const fs = require('fs');
try {
  const content = fs.readFileSync('/home/ubuntu/logs/api-out.log', 'utf8');
  const lines = content.trim().split('\n');
  console.log(lines.slice(-20).join('\n'));
} catch (e) {
  console.error(e.message);
}

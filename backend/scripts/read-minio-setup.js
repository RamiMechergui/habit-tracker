const fs = require('fs');
try {
  const content = fs.readFileSync('/home/ubuntu/ec2-setup-minio.sh', 'utf8');
  console.log('=== /home/ubuntu/ec2-setup-minio.sh ===');
  console.log(content);
} catch (e) {
  console.log('Could not read ec2-setup-minio.sh:', e.message);
}

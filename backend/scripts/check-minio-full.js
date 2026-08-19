const fs = require('fs');
const { execSync } = require('child_process');

try {
  const ps = execSync('ps aux | grep -i minio', { encoding: 'utf8' });
  console.log('MinIO processes:', ps);
} catch (e) {
  console.log('No MinIO process running.');
}

try {
  const which = execSync('which minio || find / -name "minio" 2>/dev/null', { encoding: 'utf8' });
  console.log('MinIO binary location:', which);
} catch (e) {
  console.log('MinIO binary not found.');
}

try {
  const svc = execSync('systemctl list-unit-files | grep minio || true', { encoding: 'utf8' });
  console.log('MinIO systemd service:', svc);
} catch (e) {
  console.log('No MinIO service found.');
}

const { execSync } = require('child_process');

try {
  const germanFiles = execSync('sudo find /var/lib/docker/volumes/minio-data/_data/learning-german-images/ -type f', { encoding: 'utf8' });
  console.log('Files in learning-german-images:\n', germanFiles);
} catch (e) {
  console.error('Error:', e.message);
}

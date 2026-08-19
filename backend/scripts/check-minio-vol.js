const { execSync } = require('child_process');

try {
  const files = execSync('sudo ls -la /var/lib/docker/volumes/minio-data/_data/ 2>/dev/null || sudo ls -la /var/lib/docker/volumes/minio-data/_data/learning-german-images/', { encoding: 'utf8' });
  console.log('MinIO volume contents:\n', files);

  const recurse = execSync('sudo find /var/lib/docker/volumes/minio-data/_data/ -type f | head -30', { encoding: 'utf8' });
  console.log('Sample files in MinIO volume:\n', recurse);
} catch (e) {
  console.error('Error reading minio volume:', e.message);
}

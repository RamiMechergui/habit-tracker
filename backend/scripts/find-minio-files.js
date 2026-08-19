const { execSync } = require('child_process');

try {
  const trash = execSync('sudo find /var/lib/docker/volumes/minio-data/_data/ -name "*xl.meta*"', { encoding: 'utf8' });
  console.log('Found xl.meta files in minio volume:\n', trash);

  // Check if there are other docker volumes
  const allVols = execSync('sudo ls -la /var/lib/docker/volumes/', { encoding: 'utf8' });
  console.log('All docker volumes:\n', allVols);
} catch (e) {
  console.error(e.message);
}

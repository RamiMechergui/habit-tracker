const { execSync } = require('child_process');

try {
  const listTrash = execSync('sudo find /var/lib/docker/volumes/minio-data/_data/.minio.sys/tmp/.trash/ -type f', { encoding: 'utf8' });
  console.log('Trash files:\n', listTrash);

  // Check file sizes
  const sizes = execSync('sudo ls -lh /var/lib/docker/volumes/minio-data/_data/.minio.sys/tmp/.trash/*/*', { encoding: 'utf8' });
  console.log('Trash files detail:\n', sizes);
} catch (e) {
  console.error(e.message);
}

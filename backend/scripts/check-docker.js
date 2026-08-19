const { execSync } = require('child_process');

try {
  const containers = execSync('sudo docker ps -a', { encoding: 'utf8' });
  console.log('Docker containers:\n', containers);
} catch (e) {
  console.error('Docker ps error:', e.message);
}

try {
  const vols = execSync('sudo docker volume ls', { encoding: 'utf8' });
  console.log('Docker volumes:\n', vols);
} catch (e) {
  console.error('Docker vol error:', e.message);
}

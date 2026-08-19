const fs = require('fs');
const path = require('path');

const DIRS_TO_CHECK = [
  '/home/ubuntu/habit-tracker/backend/uploads',
  '/home/ubuntu/habit-tracker/uploads',
  '/home/ubuntu/minio-data',
  '/home/ubuntu/minio',
  '/data/minio',
  '/var/minio',
  '/home/ubuntu/.minio',
  '/var/www/uploads'
];

for (const d of DIRS_TO_CHECK) {
  if (fs.existsSync(d)) {
    const files = fs.readdirSync(d);
    console.log(`Directory [${d}] exists! Contains ${files.length} items:`, files.slice(0, 10));
  } else {
    console.log(`Directory [${d}] does not exist.`);
  }
}

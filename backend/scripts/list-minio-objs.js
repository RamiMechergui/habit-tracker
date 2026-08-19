const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function listMinio() {
  const s3 = new S3Client({
    endpoint: 'http://localhost:9000',
    credentials: { accessKeyId: 'admin', secretAccessKey: 'password123' },
    region: 'us-east-1',
    forcePathStyle: true,
  });

  const res = await s3.send(new ListObjectsV2Command({
    Bucket: 'learning-german-images'
  }));

  console.log(`Total objects in MinIO bucket: ${res.KeyCount}`);
  if (res.Contents) {
    res.Contents.forEach(c => console.log(` - Key: ${c.Key} (${c.Size} bytes)`));
  }
}

listMinio().catch(console.error);

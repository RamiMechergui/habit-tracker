const { S3Client, ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function testS3() {
  console.log('=== Checking AWS S3 with IAM role ===');
  const s3 = new S3Client({ region: 'us-east-1' });
  try {
    const buckets = await s3.send(new ListBucketsCommand({}));
    console.log('Available S3 Buckets:', buckets.Buckets.map(b => b.Name));

    for (const b of buckets.Buckets) {
      try {
        const objs = await s3.send(new ListObjectsV2Command({ Bucket: b.Name, MaxKeys: 10 }));
        console.log(`Bucket [${b.Name}] objects count (sample):`, objs.KeyCount);
        if (objs.Contents) {
          console.log('Sample keys in', b.Name, ':', objs.Contents.map(c => c.Key));
        }
      } catch (err) {
        console.log(`Could not list ${b.Name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('S3 ListBuckets error:', err.message);
  }
}

testS3().catch(console.error);

const { S3Client, HeadBucketCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const BUCKETS = [
  'learning-german-images',
  'habit-tracker-images',
  'habit-tracker-storage',
  'evolvio-images',
  'evolvia-images',
  'habit-tracker-german-images'
];

async function testSpecificBuckets() {
  const s3 = new S3Client({ region: 'us-east-1' });

  for (const b of BUCKETS) {
    try {
      console.log(`Checking bucket "${b}"...`);
      await s3.send(new HeadBucketCommand({ Bucket: b }));
      console.log(`✅ Bucket "${b}" EXISTS!`);
      const objs = await s3.send(new ListObjectsV2Command({ Bucket: b, MaxKeys: 20 }));
      console.log(`Objects in ${b} (${objs.KeyCount || 0}):`, objs.Contents ? objs.Contents.map(c => c.Key) : 'none');
    } catch (err) {
      console.log(`❌ Bucket "${b}":`, err.message);
    }
  }
}

testSpecificBuckets().catch(console.error);

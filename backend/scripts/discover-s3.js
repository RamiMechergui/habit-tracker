const { S3Client, GetBucketLocationCommand, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET_CANDIDATES = [
  'learning-german-images',
  'habit-tracker-bucket',
  'habit-tracker-uploads',
  'habit-tracker-images',
  'habit-tracker-prod',
  'evolvio-images',
  'evolvia-images',
  'evolvio-bucket',
  'evolvia-bucket',
  'habit-tracker-storage'
];

const REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1',
  'ca-central-1', 'ap-south-1', 'ap-southeast-1', 'ap-northeast-1', 'me-south-1', 'af-south-1'
];

async function findBucketsAndImages() {
  console.log('=== Finding Real AWS S3 Bucket & Region ===');

  for (const b of BUCKET_CANDIDATES) {
    for (const reg of REGIONS) {
      const s3 = new S3Client({ region: reg });
      try {
        const res = await s3.send(new ListObjectsV2Command({ Bucket: b, MaxKeys: 5 }));
        console.log(`\n🎉 BUCKET FOUND!`);
        console.log(`  Bucket Name: ${b}`);
        console.log(`  Region:      ${reg}`);
        console.log(`  Key Count:   ${res.KeyCount}`);
        if (res.Contents) {
          console.log(`  Sample keys:`, res.Contents.map(c => `${c.Key} (${c.Size} bytes)`));
        }
        break; // found region for this bucket, move to next bucket
      } catch (err) {
        if (err.name === 'PermanentRedirect' || err.name === 'AuthorizationHeaderMalformed') {
          // Wrong region, continue checking regions
          continue;
        } else if (err.name === 'NoSuchBucket') {
          // Bucket doesn't exist anywhere
          break;
        } else if (err.name === 'AccessDenied') {
          console.log(`  Bucket [${b}] exists in region [${reg}] (AccessDenied - checking next)`);
        }
      }
    }
  }
}

findBucketsAndImages().catch(console.error);

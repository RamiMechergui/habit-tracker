const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const BUCKET = 'amazons3buketht';
const REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1',
  'ca-central-1', 'ap-south-1', 'ap-southeast-1', 'ap-northeast-1', 'me-south-1', 'af-south-1'
];

async function checkBucket() {
  console.log(`Checking S3 bucket "${BUCKET}" across regions...`);
  for (const reg of REGIONS) {
    const s3 = new S3Client({ region: reg });
    try {
      const res = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, MaxKeys: 20 }));
      console.log(`\n🎉 Bucket "${BUCKET}" found in region: [${reg}]`);
      console.log(`Total Keys: ${res.KeyCount}`);
      if (res.Contents) {
        console.log('Sample Keys in bucket:');
        res.Contents.forEach(c => console.log(` - ${c.Key} (${(c.Size / 1024).toFixed(1)} KB)`));
      }
      return { region: reg, keys: res.Contents };
    } catch (err) {
      if (err.name !== 'PermanentRedirect' && err.name !== 'AuthorizationHeaderMalformed' && err.name !== 'NoSuchBucket') {
        console.log(`Region ${reg}: ${err.name} - ${err.message}`);
      }
    }
  }
}

checkBucket().catch(console.error);

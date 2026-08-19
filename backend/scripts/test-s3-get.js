const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET_NAMES = [
  'learning-german-images',
  'habit-tracker-images',
  'habit-tracker-images-308621094144',
  'learning-german-images-308621094144',
  'evolvio-images-308621094144',
  'habit-tracker-bucket',
  'habit-tracker-prod',
  'habit-tracker-uploads'
];

const TEST_KEY = 'german/alphabet/2c65a27a-dd8a-4729-a3ea-168cff7e02df/ALPHABET#9da10672-8bb8-48da-9f8e-3a31d616af7c_1785953705534';

async function testS3Keys() {
  const s3 = new S3Client({ region: 'us-east-1' });

  for (const b of BUCKET_NAMES) {
    try {
      console.log(`Trying S3 bucket "${b}" for key...`);
      const res = await s3.send(new GetObjectCommand({ Bucket: b, Key: TEST_KEY }));
      console.log(`🎉 FOUND IN AWS S3 BUCKET "${b}"! ContentLength: ${res.ContentLength}`);
      return;
    } catch (e) {
      console.log(`  ${b}: ${e.name} - ${e.message}`);
    }
  }
}

testS3Keys().catch(console.error);

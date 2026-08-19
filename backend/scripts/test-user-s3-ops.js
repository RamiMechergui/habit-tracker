const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

async function testObjectOps() {
  const s3 = new S3Client({ region: 'us-east-1' });
  const bucket = 'amazons3buketht';
  const testKey = 'german/alphabet/2c65a27a-dd8a-4729-a3ea-168cff7e02df/ALPHABET#9da10672-8bb8-48da-9f8e-3a31d616af7c_1785953705534';

  console.log(`=== Testing GetObject on bucket "${bucket}" ===`);
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: testKey }));
    console.log(`🎉 SUCCESS! Object found. ContentLength: ${res.ContentLength}, ContentType: ${res.ContentType}`);
  } catch (err) {
    console.log(`GetObject for key [${testKey}]: ${err.name} - ${err.message}`);
  }

  console.log(`\n=== Testing PutObject on bucket "${bucket}" ===`);
  try {
    const testPutKey = 'test-probe.txt';
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: testPutKey, Body: 'test', ContentType: 'text/plain' }));
    console.log(`🎉 SUCCESS! PutObject worked on bucket "${bucket}"`);
  } catch (err) {
    console.log(`PutObject: ${err.name} - ${err.message}`);
  }
}

testObjectOps().catch(console.error);

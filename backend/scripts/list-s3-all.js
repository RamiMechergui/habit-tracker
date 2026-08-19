const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function listAll() {
  const s3 = new S3Client({ region: 'us-east-1' });
  const bucket = 'amazons3buketht';
  let total = 0;
  let continuationToken;

  console.log(`=== Listing objects in bucket "${bucket}" ===`);
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    }));
    total += res.KeyCount;
    if (res.Contents) {
      res.Contents.forEach(c => console.log(` - ${c.Key} (${(c.Size/1024).toFixed(1)} KB)`));
    }
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  console.log(`\nTotal objects: ${total}`);
}

listAll().catch(console.error);

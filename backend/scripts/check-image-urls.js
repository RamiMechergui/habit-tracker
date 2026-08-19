const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const USER_ID = '2c65a27a-dd8a-4729-a3ea-168cff7e02df';

async function checkImageUrls() {
  const raw = new DynamoDBClient({ region: 'us-east-1' });
  const doc = DynamoDBDocumentClient.from(raw);

  const tables = ['HabitGerman', 'HabitPlannedBooks', 'HabitNotes', 'HabitWishlist', 'HabitAvatarHistory', 'HabitUsers'];

  for (const t of tables) {
    const res = await doc.send(new ScanCommand({ TableName: t }));
    const userItems = res.Items.filter(i => (i.userId === USER_ID || t === 'HabitUsers' && i.userId === USER_ID));
    
    console.log(`\n=== Table [${t}] Images for ${USER_ID} ===`);
    for (const item of userItems) {
      const urls = [];
      if (item.photoUrl) urls.push(`photoUrl: ${item.photoUrl}`);
      if (item.imageUrl) urls.push(`imageUrl: ${item.imageUrl}`);
      if (item.profilePicture) urls.push(`profilePicture: ${item.profilePicture}`);
      if (urls.length > 0) {
        console.log(`  - Record ${item.recordId || item.bookId || item.itemId || item.userId || item.date}: ${urls.join(' | ')}`);
      }
    }
  }
}

checkImageUrls().catch(console.error);

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { docClient, rawClient } = require('../db/dynamodb');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { ListTablesCommand } = require('@aws-sdk/client-dynamodb');

async function inspectOldUsers() {
  const tables = [
    'HabitNotes', 'HabitLogs', 'HabitExpenses', 'HabitGerman', 
    'HabitCredentials', 'HabitSavings', 'HabitPlannedBooks', 
    'HabitMilestones', 'HabitWishlist', 'HabitSessions'
  ];

  for (const t of tables) {
    const res = await docClient.send(new ScanCommand({ TableName: t }));
    const items = res.Items || [];
    
    // Group count by userId
    const counts = {};
    for (const it of items) {
      const uid = it.userId || 'none';
      counts[uid] = (counts[uid] || 0) + 1;
    }
    console.log(`\nTable ${t}:`);
    for (const [uid, c] of Object.entries(counts)) {
      console.log(`   userId ${uid}: ${c} records`);
    }
  }
}

inspectOldUsers().catch(console.error);

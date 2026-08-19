/**
 * restore-user-data.js
 * Restores street.cherk@gmail.com to point to the correct userId (2c65a27a-dd8a-4729-a3ea-168cff7e02df)
 * and migrates all orphan records so that 100% of the user data is restored.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { docClient, rawClient } = require('../db/dynamodb');
const { ScanCommand, PutCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const fs = require('fs');
const path = require('path');

const TARGET_EMAIL = 'street.cherk@gmail.com';
const MAIN_USER_ID = '2c65a27a-dd8a-4729-a3ea-168cff7e02df';
const TEMP_USER_ID = 'ca4b7b29-7a80-4ae4-840d-074522d2e929';
const OTHER_ORPHAN_UIDS = [
  '048e11d7-d443-4ec5-8a8a-211f5de8416f',
  '91a44df7-2f89-498e-a7b0-16529c54a77d',
  '431179f6-9835-46c8-a3df-09c59dfd820f'
];

async function scanAll(TableName) {
  let items = [];
  let LastEvaluatedKey;
  do {
    const res = await docClient.send(new ScanCommand({
      TableName,
      ...(LastEvaluatedKey && { ExclusiveStartKey: LastEvaluatedKey }),
    }));
    items = items.concat(res.Items || []);
    LastEvaluatedKey = res.LastEvaluatedKey;
  } while (LastEvaluatedKey);
  return items;
}

async function run() {
  console.log('====================================================');
  console.log('🚀 Starting Data Restoration for:', TARGET_EMAIL);
  console.log('====================================================\n');

  // STEP 1: Full snapshot backup before any changes
  console.log('📦 Step 1: Creating snapshot backup...');
  const { TableNames } = await rawClient.send(new ListTablesCommand({}));
  const fullBackup = {};
  for (const t of TableNames) {
    fullBackup[t] = await scanAll(t);
  }
  const backupFile = path.join(__dirname, '..', `pre_restore_backup_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(fullBackup, null, 2));
  console.log(`✅ Snapshot saved to: ${backupFile}\n`);

  // STEP 2: Fetch the existing user item for street.cherk@gmail.com
  console.log('👤 Step 2: Fixing HabitUsers profile...');
  const users = await scanAll('HabitUsers');
  const tempUser = users.find(u => u.email === TARGET_EMAIL && u.userId === TEMP_USER_ID);
  
  // Construct the restored user item with MAIN_USER_ID
  const restoredUser = {
    userId: MAIN_USER_ID,
    email: TARGET_EMAIL.toLowerCase().trim(),
    passwordHash: tempUser ? tempUser.passwordHash : '$2a$10$YuttbabnRrc0pUe58E0EnuUz57gYjAW46dqra6i9Adsrt5TSZUGaa',
    firstName: tempUser ? tempUser.firstName : 'Rami',
    lastName: tempUser ? tempUser.lastName : 'Mechergui',
    profilePicture: tempUser ? tempUser.profilePicture || '' : '',
    expenseCategories: tempUser ? tempUser.expenseCategories || [] : [],
    currentBook: tempUser ? tempUser.currentBook || { bookName: '', targetPages: 0, startDate: '', isActive: false, photoUrl: '' } : { bookName: '', targetPages: 0, startDate: '', isActive: false, photoUrl: '' },
    archivedBooks: tempUser ? tempUser.archivedBooks || [] : [],
    plannedBooks: tempUser ? tempUser.plannedBooks || [] : [],
    history: tempUser ? tempUser.history || [] : [],
    sessionCleanupConfirmedAt: null,
    essentials: tempUser ? tempUser.essentials || [] : [],
    pushSubscription: null,
    createdAt: tempUser ? tempUser.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Put the restored user item
  await docClient.send(new PutCommand({
    TableName: 'HabitUsers',
    Item: restoredUser,
  }));
  console.log(`✅ Saved HabitUsers record for ${TARGET_EMAIL} with primary userId: ${MAIN_USER_ID}`);

  // Delete the temporary orphan record if it exists
  if (tempUser) {
    await docClient.send(new DeleteCommand({
      TableName: 'HabitUsers',
      Key: { userId: TEMP_USER_ID },
    }));
    console.log(`✅ Removed temporary user record: ${TEMP_USER_ID}`);
  }

  // STEP 3: Merge minor orphan items from previous test IDs into MAIN_USER_ID
  console.log('\n🔄 Step 3: Merging orphan records into main account...');
  const tablesToMerge = [
    { name: 'HabitCredentials', sortKey: 'credentialId' },
    { name: 'HabitLogs',        sortKey: 'date' },
    { name: 'HabitSavings',     sortKey: 'entryId' },
    { name: 'HabitWishlist',    sortKey: 'itemId' },
    { name: 'HabitExpenses',    sortKey: 'date' },
    { name: 'HabitNotes',       sortKey: 'noteId' },
  ];

  for (const t of tablesToMerge) {
    const allItems = await scanAll(t.name);
    for (const item of allItems) {
      if (OTHER_ORPHAN_UIDS.includes(item.userId)) {
        console.log(`  Merging [${t.name}] item ${item[t.sortKey]} from ${item.userId} -> ${MAIN_USER_ID}`);
        // Create new item for MAIN_USER_ID
        const newItem = { ...item, userId: MAIN_USER_ID };
        await docClient.send(new PutCommand({
          TableName: t.name,
          Item: newItem,
        }));
      }
    }
  }

  // STEP 4: Final Verification
  console.log('\n📊 Step 4: Final Data Verification for', TARGET_EMAIL, `(${MAIN_USER_ID}):`);
  for (const t of TableNames) {
    if (t === 'HabitUsers') continue;
    const items = await scanAll(t);
    const userItems = items.filter(it => it.userId === MAIN_USER_ID);
    console.log(`  - ${t.padEnd(20)}: ${userItems.length} records`);
  }

  console.log('\n🎉 RESTORATION COMPLETED SUCCESSFULLY!');
}

run().catch(err => {
  console.error('❌ Restore failed:', err);
  process.exit(1);
});

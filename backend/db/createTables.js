/**
 * db/createTables.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Creates all DynamoDB tables required by the Habit Tracker app.
 * Safe to run multiple times — skips tables that already exist.
 *
 * Tables:
 *   HabitUsers        — users (with EmailIndex GSI)
 *   HabitLogs         — daily habit logs (userId + date)
 *   HabitExpenses     — daily expenses (userId + date)
 *   HabitNotes        — notes (userId + noteId, with UserDateIndex GSI)
 *   HabitCredentials  — encrypted credentials (userId + credentialId)
 *   HabitSettings     — user settings (userId only)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const {
  CreateTableCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} = require('@aws-sdk/client-dynamodb');
const { rawClient } = require('./dynamodb');

const TABLES = [
  // ── HabitUsers ────────────────────────────────────────────────────────────
  {
    TableName: 'HabitUsers',
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'email',  AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'EmailIndex',
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // ── HabitLogs ─────────────────────────────────────────────────────────────
  {
    TableName: 'HabitLogs',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'date',   KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'date',   AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // ── HabitExpenses ─────────────────────────────────────────────────────────
  {
    TableName: 'HabitExpenses',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'date',   KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'date',   AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // ── HabitNotes ────────────────────────────────────────────────────────────
  {
    TableName: 'HabitNotes',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'noteId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'noteId', AttributeType: 'S' },
      { AttributeName: 'date',   AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UserDateIndex',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'date',   KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // ── HabitCredentials ──────────────────────────────────────────────────────
  {
    TableName: 'HabitCredentials',
    KeySchema: [
      { AttributeName: 'userId',       KeyType: 'HASH' },
      { AttributeName: 'credentialId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId',       AttributeType: 'S' },
      { AttributeName: 'credentialId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // ── HabitSettings ─────────────────────────────────────────────────────────
  {
    TableName: 'HabitSettings',
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // ── HabitGerman ───────────────────────────────────────────────────────────
  // Single-table design: recordId prefix determines type:
  //   VOCAB#<uuid>    → vocabulary entry
  //   GRAMMAR#<uuid>  → grammar rule
  //   NOTE#YYYY-MM-DD → daily study note
  {
    TableName: 'HabitGerman',
    KeySchema: [
      { AttributeName: 'userId',   KeyType: 'HASH' },
      { AttributeName: 'recordId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId',   AttributeType: 'S' },
      { AttributeName: 'recordId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // ── HabitAws ──────────────────────────────────────────────────────────────
  // Single-table design: recordId prefix determines type:
  //   SERVICE#<uuid>  → AWS service note
  //   CERT#<uuid>     → certification prep entry
  //   NOTE#YYYY-MM-DD → daily study note
  {
    TableName: 'HabitAws',
    KeySchema: [
      { AttributeName: 'userId',   KeyType: 'HASH' },
      { AttributeName: 'recordId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId',   AttributeType: 'S' },
      { AttributeName: 'recordId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // ── HabitWishlist ─────────────────────────────────────────────────────────
  {
    TableName: 'HabitWishlist',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'itemId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'itemId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // ── HabitSessions ────────────────────────────────────────────────────────
  {
    TableName: 'HabitSessions',
    KeySchema: [
      { AttributeName: 'userId',    KeyType: 'HASH' },
      { AttributeName: 'sessionId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId',    AttributeType: 'S' },
      { AttributeName: 'sessionId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // ── HabitPlannedBooks ────────────────────────────────────────────────────
  {
    TableName: 'HabitPlannedBooks',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'bookId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'bookId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // ── HabitArchivedBooks ───────────────────────────────────────────────────
  {
    TableName: 'HabitArchivedBooks',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'bookId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'bookId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // ── HabitMilestones ──────────────────────────────────────────────────────
  {
    TableName: 'HabitMilestones',
    KeySchema: [
      { AttributeName: 'userId',     KeyType: 'HASH' },
      { AttributeName: 'milestoneId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId',     AttributeType: 'S' },
      { AttributeName: 'milestoneId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // ── HabitSavings ─────────────────────────────────────────────────────────
  {
    TableName: 'HabitSavings',
    KeySchema: [
      { AttributeName: 'userId',  KeyType: 'HASH' },
      { AttributeName: 'entryId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId',  AttributeType: 'S' },
      { AttributeName: 'entryId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },

  // ── HabitAvatarHistory ──────────────────────────────────────────────────
  {
    TableName: 'HabitAvatarHistory',
    KeySchema: [
      { AttributeName: 'userId',    KeyType: 'HASH' },
      { AttributeName: 'versionId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId',      AttributeType: 'S' },
      { AttributeName: 'versionId',   AttributeType: 'S' },
      { AttributeName: 'versionNumber', AttributeType: 'N' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UserIdVersionIndex',
        KeySchema: [
          { AttributeName: 'userId',        KeyType: 'HASH' },
          { AttributeName: 'versionNumber', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
];

/**
 * Checks whether a DynamoDB table already exists.
 * @param {string} tableName
 * @returns {Promise<boolean>}
 */
async function tableExists(tableName) {
  try {
    await rawClient.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return false;
    throw err;
  }
}

/**
 * Creates all tables. Skips existing ones.
 * Called automatically from server.js on startup (development) and can be
 * run standalone: `node backend/db/createTables.js`
 */
async function createTables() {
  console.log('[DynamoDB] Bootstrapping tables…');
  for (const tableConfig of TABLES) {
    const exists = await tableExists(tableConfig.TableName);
    if (exists) {
      console.log(`[DynamoDB]   ✓ ${tableConfig.TableName} already exists — skipping`);
      continue;
    }
    try {
      await rawClient.send(new CreateTableCommand(tableConfig));
      // Wait until the table is ACTIVE before continuing
      await waitUntilTableExists(
        { client: rawClient, maxWaitTime: 30 },
        { TableName: tableConfig.TableName }
      );
      console.log(`[DynamoDB]   ✔ ${tableConfig.TableName} created`);
    } catch (err) {
      console.error(`[DynamoDB]   ✗ Failed to create ${tableConfig.TableName}:`, err.message);
      throw err;
    }
  }
  console.log('[DynamoDB] All tables ready.');
}

module.exports = { createTables };

// Allow standalone execution: `node db/createTables.js`
if (require.main === module) {
  createTables()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

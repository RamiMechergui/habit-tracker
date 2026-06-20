/**
 * scripts/migrate-mongo-to-dynamo.js
 * ──────────────────────────────────────────────────────────────────────────────
 * One-time migration script: reads all data from MongoDB and writes it to
 * DynamoDB (Local or AWS).
 *
 * Usage:
 *   MONGO_URI=mongodb://... DYNAMODB_ENDPOINT=http://localhost:8000 \
 *     node backend/scripts/migrate-mongo-to-dynamo.js
 *
 * The script is idempotent: existing DynamoDB items are NOT overwritten
 * (uses ConditionExpression: attribute_not_exists(pk)).
 * Run with --overwrite flag to force overwrite existing items.
 *
 * Migration order: users → settings → logs → expenses → notes → credentials
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose  = require('mongoose');
const bcrypt    = require('bcryptjs');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient }  = require('../db/dynamodb');
const { createTables } = require('../db/createTables');

const OVERWRITE = process.argv.includes('--overwrite');

// ── Mongoose schemas (minimal, read-only) ─────────────────────────────────────
const userSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const logSchema  = new mongoose.Schema({}, { strict: false, timestamps: true });
const expSchema  = new mongoose.Schema({}, { strict: false, timestamps: true });
const noteSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const credSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const settSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const MongoUser       = mongoose.model('User',       userSchema, 'users');
const MongoLog        = mongoose.model('Log',        logSchema,  'logs');
const MongoExpense    = mongoose.model('Expense',    expSchema,  'expenses');
const MongoNote       = mongoose.model('Note',       noteSchema, 'notes');
const MongoCredential = mongoose.model('Credential', credSchema, 'credentials');
const MongoSettings   = mongoose.model('Settings',   settSchema, 'settings');

// ── Helpers ───────────────────────────────────────────────────────────────────

const stats = { migrated: 0, skipped: 0, errors: 0 };

async function putItem(TableName, Item, conditionKey = 'userId') {
  const params = { TableName, Item };
  if (!OVERWRITE) {
    params.ConditionExpression = `attribute_not_exists(${conditionKey})`;
  }
  try {
    await docClient.send(new PutCommand(params));
    stats.migrated++;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      stats.skipped++;
    } else {
      console.error(`  ✗ Error writing to ${TableName}:`, err.message);
      stats.errors++;
    }
  }
}

function toStr(val) {
  if (!val) return '';
  return val.toString();
}

function toISO(val) {
  if (!val) return new Date().toISOString();
  return new Date(val).toISOString();
}

// ── Migration functions ───────────────────────────────────────────────────────

async function migrateUsers() {
  console.log('\n[Users] Migrating…');
  const users = await MongoUser.find({}).lean();
  console.log(`  Found ${users.length} users`);

  for (const u of users) {
    const userId = toStr(u._id);

    // Migrate essentials — add essentialId field if missing
    const essentials = (u.essentials || []).map(e => ({
      essentialId: toStr(e._id) || require('crypto').randomUUID(),
      _id:         toStr(e._id),
      name:        e.name        || '',
      icon:        e.icon        || '🧴',
      status:      e.status      || 'A',
      lastUpdated: toISO(e.lastUpdated),
    }));

    const item = {
      userId,
      email:             (u.email || '').toLowerCase().trim(),
      passwordHash:      u.password || '',    // already bcrypt-hashed in MongoDB
      firstName:         u.firstName          || '',
      lastName:          u.lastName           || '',
      profilePicture:    u.profilePicture     || '',
      expenseCategories: u.expenseCategories  || [],
      currentBook:       u.currentBook        || { bookName: '', targetPages: 0, startDate: '', isActive: false },
      archivedBooks:     u.archivedBooks      || [],
      essentials,
      pushSubscription:  u.pushSubscription   || null,
      createdAt:         toISO(u.createdAt),
      updatedAt:         toISO(u.updatedAt),
    };

    await putItem('HabitUsers', item, 'userId');
  }
  console.log(`  Done — migrated: ${stats.migrated}, skipped: ${stats.skipped}, errors: ${stats.errors}`);
}

async function migrateLogs() {
  console.log('\n[Logs] Migrating…');
  const prev = { ...stats };
  const logs  = await MongoLog.find({}).lean();
  console.log(`  Found ${logs.length} log entries`);

  for (const l of logs) {
    const item = {
      userId:    toStr(l.userId),
      date:      l.date || '',
      data:      l.data || {},
      createdAt: toISO(l.createdAt),
      updatedAt: toISO(l.updatedAt),
    };
    await putItem('HabitLogs', item, 'userId');
  }
  const d = stats.migrated - prev.migrated;
  console.log(`  Done — migrated: ${d}, skipped: ${stats.skipped - prev.skipped}, errors: ${stats.errors - prev.errors}`);
}

async function migrateExpenses() {
  console.log('\n[Expenses] Migrating…');
  const prev     = { ...stats };
  const expenses = await MongoExpense.find({}).lean();
  console.log(`  Found ${expenses.length} expense entries`);

  for (const e of expenses) {
    const item = {
      userId:    toStr(e.userId),
      date:      e.date || '',
      expenses:  e.expenses || [],
      createdAt: toISO(e.createdAt),
      updatedAt: toISO(e.updatedAt),
    };
    await putItem('HabitExpenses', item, 'userId');
  }
  const d = stats.migrated - prev.migrated;
  console.log(`  Done — migrated: ${d}, skipped: ${stats.skipped - prev.skipped}, errors: ${stats.errors - prev.errors}`);
}

async function migrateNotes() {
  console.log('\n[Notes] Migrating…');
  const prev  = { ...stats };
  const notes = await MongoNote.find({}).lean();
  console.log(`  Found ${notes.length} notes`);

  for (const n of notes) {
    const item = {
      userId:    toStr(n.userId),
      noteId:    toStr(n._id),
      date:      n.date    || '',
      content:   n.content || '',
      createdAt: toISO(n.createdAt),
      updatedAt: toISO(n.updatedAt),
    };
    await putItem('HabitNotes', item, 'noteId');
  }
  const d = stats.migrated - prev.migrated;
  console.log(`  Done — migrated: ${d}, skipped: ${stats.skipped - prev.skipped}, errors: ${stats.errors - prev.errors}`);
}

async function migrateCredentials() {
  console.log('\n[Credentials] Migrating…');
  const prev        = { ...stats };
  const credentials = await MongoCredential.find({}).lean();
  console.log(`  Found ${credentials.length} credentials`);

  for (const c of credentials) {
    const item = {
      userId:       toStr(c.userId),
      credentialId: toStr(c._id),
      serviceName:  c.serviceName || '',
      url:          c.url         || '',
      username:     c.username    || '',
      password:     c.password    || '',   // already AES-encrypted
      notes:        c.notes       || '',
      category:     c.category    || 'Other',
      isPinned:     !!c.isPinned,
      tags:         c.tags        || [],
      createdAt:    toISO(c.createdAt),
      updatedAt:    toISO(c.updatedAt),
    };
    await putItem('HabitCredentials', item, 'credentialId');
  }
  const d = stats.migrated - prev.migrated;
  console.log(`  Done — migrated: ${d}, skipped: ${stats.skipped - prev.skipped}, errors: ${stats.errors - prev.errors}`);
}

async function migrateSettings() {
  console.log('\n[Settings] Migrating…');
  const prev     = { ...stats };
  const settings = await MongoSettings.find({}).lean();
  console.log(`  Found ${settings.length} settings documents`);

  for (const s of settings) {
    const item = {
      userId:         toStr(s.userId),
      theme:          s.theme          || 'dark',
      recurringTasks: s.recurringTasks || {},
      timelinePrefs:  s.timelinePrefs  || { defaultDuration: 30, intervalGranularity: 30 },
    };
    await putItem('HabitSettings', item, 'userId');
  }
  const d = stats.migrated - prev.migrated;
  console.log(`  Done — migrated: ${d}, skipped: ${stats.skipped - prev.skipped}, errors: ${stats.errors - prev.errors}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const mongoURI = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/habittracker';
  console.log(`[Migration] Connecting to MongoDB: ${mongoURI}`);
  await mongoose.connect(mongoURI);
  console.log('[Migration] MongoDB connected');

  console.log('[Migration] Bootstrapping DynamoDB tables…');
  await createTables();

  if (OVERWRITE) {
    console.log('[Migration] ⚠  --overwrite flag set: existing items WILL be replaced');
  }

  await migrateUsers();
  await migrateSettings();
  await migrateLogs();
  await migrateExpenses();
  await migrateNotes();
  await migrateCredentials();

  console.log('\n══════════════════════════════════════════');
  console.log(`  Migration complete`);
  console.log(`  Total migrated : ${stats.migrated}`);
  console.log(`  Total skipped  : ${stats.skipped}`);
  console.log(`  Total errors   : ${stats.errors}`);
  console.log('══════════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[Migration] Fatal error:', err);
  process.exit(1);
});

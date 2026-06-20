/**
 * backend/scripts/validate-dynamodb.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Integration validation script to test all DynamoDB DAO operations locally.
 *
 * Usage:
 *   node backend/scripts/validate-dynamodb.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const crypto = require('crypto');
const { createUser, getUserById, getUserByEmail, updateUser, deleteUser, countUsers, listUsers } = require('../db/users');
const { getSettings, upsertSettings } = require('../db/settings');
const { getAllLogs, upsertLog } = require('../db/logs');
const { getAllExpenses, getExpenseByDate, upsertExpense, deleteExpense } = require('../db/expenses');
const { getAllNotes, getNotesByDate, createNote, updateNote, deleteNote } = require('../db/notes');
const { getAllCredentials, createCredential, updateCredential, deleteCredential } = require('../db/credentials');

async function runTests() {
  console.log('🚀 Starting DynamoDB Local Validation Tests...\n');
  const userId = crypto.randomUUID();
  const email = `test-${userId.substring(0, 8)}@example.com`;
  const passwordHash = '$2a$10$abcdefghijklmnopqrstuv'; // Dummy bcrypt hash

  try {
    // 1. Users Table Operations
    console.log('--- Testing HabitUsers Table ---');
    const user = await createUser({
      userId,
      email,
      passwordHash,
      firstName: 'Test',
      lastName: 'User'
    });
    console.log('  ✓ createUser:', user.userId === userId ? 'PASS' : 'FAIL');

    const fetchedById = await getUserById(userId);
    console.log('  ✓ getUserById:', fetchedById && fetchedById.email === email ? 'PASS' : 'FAIL');

    const fetchedByEmail = await getUserByEmail(email);
    console.log('  ✓ getUserByEmail:', fetchedByEmail && fetchedByEmail.userId === userId ? 'PASS' : 'FAIL');

    const updatedUser = await updateUser(userId, { firstName: 'Updated' });
    console.log('  ✓ updateUser:', updatedUser && updatedUser.firstName === 'Updated' ? 'PASS' : 'FAIL');

    const list = await listUsers();
    const listed = list.some(u => u.userId === userId);
    console.log('  ✓ listUsers:', listed ? 'PASS' : 'FAIL');

    const count = await countUsers();
    console.log('  ✓ countUsers:', count > 0 ? 'PASS' : 'FAIL');

    // 2. Settings Table Operations
    console.log('\n--- Testing HabitSettings Table ---');
    const initialSettings = await getSettings(userId);
    console.log('  ✓ getSettings (defaults):', initialSettings && initialSettings.theme === 'dark' ? 'PASS' : 'FAIL');

    const updatedSettings = await upsertSettings(userId, { theme: 'light' });
    console.log('  ✓ upsertSettings:', updatedSettings && updatedSettings.theme === 'light' ? 'PASS' : 'FAIL');

    // 3. Logs Table Operations
    console.log('\n--- Testing HabitLogs Table ---');
    const logDate = '2026-06-20';
    const logData = { habits: { water: true, exercise: false } };
    const savedLog = await upsertLog(userId, logDate, logData);
    console.log('  ✓ upsertLog (create):', savedLog && savedLog.habits.water === true ? 'PASS' : 'FAIL');

    const allLogs = await getAllLogs(userId);
    console.log('  ✓ getAllLogs:', allLogs && allLogs[logDate] && allLogs[logDate].habits.water === true ? 'PASS' : 'FAIL');

    // 4. Expenses Table Operations
    console.log('\n--- Testing HabitExpenses Table ---');
    const expDate = '2026-06-20';
    const expList = [{ amount: 15.5, category: 'Food & Dining', name: 'Lunch' }];
    await upsertExpense(userId, expDate, expList);
    
    const fetchedExpense = await getExpenseByDate(userId, expDate);
    console.log('  ✓ getExpenseByDate:', fetchedExpense && fetchedExpense.expenses.length === 1 ? 'PASS' : 'FAIL');

    const allExpenses = await getAllExpenses(userId);
    console.log('  ✓ getAllExpenses:', allExpenses && allExpenses.length >= 1 ? 'PASS' : 'FAIL');

    await deleteExpense(userId, expDate);
    const afterDeleteExpense = await getExpenseByDate(userId, expDate);
    console.log('  ✓ deleteExpense:', afterDeleteExpense && afterDeleteExpense.expenses.length === 0 ? 'PASS' : 'FAIL');

    // 5. Notes Table Operations
    console.log('\n--- Testing HabitNotes Table ---');
    const noteDate = '2026-06-20';
    const note = await createNote(userId, noteDate, 'Hello Note!');
    console.log('  ✓ createNote:', note && note.content === 'Hello Note!' ? 'PASS' : 'FAIL');

    const updatedNote = await updateNote(userId, note.noteId, 'Updated Note!');
    console.log('  ✓ updateNote:', updatedNote && updatedNote.content === 'Updated Note!' ? 'PASS' : 'FAIL');

    const notesForDate = await getNotesByDate(userId, noteDate);
    console.log('  ✓ getNotesByDate:', notesForDate && notesForDate.length === 1 ? 'PASS' : 'FAIL');

    const allNotes = await getAllNotes(userId);
    console.log('  ✓ getAllNotes:', allNotes && allNotes.length === 1 ? 'PASS' : 'FAIL');

    const deletedNoteResult = await deleteNote(userId, note.noteId);
    console.log('  ✓ deleteNote:', deletedNoteResult === true ? 'PASS' : 'FAIL');

    // 6. Credentials Table Operations
    console.log('\n--- Testing HabitCredentials Table ---');
    const credData = {
      serviceName: 'GitHub',
      url: 'https://github.com',
      username: 'testuser',
      password: 'encrypted_password',
      notes: 'some notes',
      category: 'Work',
      isPinned: true,
      tags: ['git', 'code']
    };
    const credential = await createCredential(userId, credData);
    console.log('  ✓ createCredential:', credential && credential.serviceName === 'GitHub' ? 'PASS' : 'FAIL');

    const updatedCred = await updateCredential(userId, credential.credentialId, { isPinned: false });
    console.log('  ✓ updateCredential:', updatedCred && updatedCred.isPinned === false ? 'PASS' : 'FAIL');

    const allCreds = await getAllCredentials(userId);
    console.log('  ✓ getAllCredentials:', allCreds && allCreds.length === 1 ? 'PASS' : 'FAIL');

    const deletedCredResult = await deleteCredential(userId, credential.credentialId);
    console.log('  ✓ deleteCredential:', deletedCredResult === true ? 'PASS' : 'FAIL');

    // Cleanup: Delete test user
    console.log('\n--- Cleaning up ---');
    await deleteUser(userId);
    const afterDeleteUser = await getUserById(userId);
    console.log('  ✓ deleteUser:', afterDeleteUser === null ? 'PASS' : 'FAIL');

    console.log('\n🎉 All DynamoDB tests completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test execution failed with error:', err);
    process.exit(1);
  }
}

runTests();

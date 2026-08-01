/**
 * scripts/sync-expense-categories.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Appends new default expense categories to existing users' stored category
 * list (DynamoDB). Existing categories are preserved; nothing is removed and
 * no duplicates are added.
 *
 * Run from the backend directory:
 *   node scripts/sync-expense-categories.js
 */
const { ScanCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../db/dynamodb');

const TABLE = 'HabitUsers';

const NEW_CATEGORIES = [
  { name: 'Office Supplies', icon: '🖊️' },
  { name: 'Telecommunication', icon: '📱' },
  { name: 'Barbering', icon: '💈' },
  { name: 'Expense Reconciliation', icon: '🧾' },
];

function normalizeCat(cat) {
  if (cat && typeof cat === 'object' && cat.name) return { name: cat.name, icon: cat.icon || '📦' };
  return { name: String(cat), icon: '📦' };
}

async function main() {
  const users = [];
  let lastKey;
  do {
    const res = await docClient.send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey: lastKey }));
    users.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Checking ${users.length} user(s)...`);

  for (const item of users) {
    const existing = Array.isArray(item.expenseCategories)
      ? item.expenseCategories.map(normalizeCat)
      : [];
    const existingNames = new Set(existing.map(c => c.name));
    const toAdd = NEW_CATEGORIES.filter(c => !existingNames.has(c.name));

    if (toAdd.length === 0) {
      console.log(`- ${item.email || item.userId}: no changes`);
      continue;
    }

    const updated = [...existing, ...toAdd];
    const now = new Date().toISOString();

    await docClient.send(new UpdateCommand({
      TableName: TABLE,
      Key: { userId: item.userId },
      UpdateExpression: 'SET expenseCategories = :c, updatedAt = :u',
      ExpressionAttributeValues: { ':c': updated, ':u': now },
    }));

    console.log(`- ${item.email || item.userId}: added ${toAdd.map(c => c.name).join(', ')}`);
  }

  console.log('Done.');
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});

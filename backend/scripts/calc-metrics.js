const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const USER_ID = '2c65a27a-dd8a-4729-a3ea-168cff7e02df';

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function computeMetrics() {
  const raw = new DynamoDBClient({ region: 'us-east-1' });
  const doc = DynamoDBDocumentClient.from(raw);

  const res = await doc.send(new QueryCommand({
    TableName: 'HabitLogs',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': USER_ID }
  }));

  const logs = {};
  res.Items.forEach(it => {
    logs[it.date] = it.data;
  });

  const calendarDate = new Date();
  const monthStart = startOfMonth(calendarDate);
  console.log(`Current Date: ${calendarDate.toISOString().slice(0, 10)}, Month Start: ${monthStart.toISOString().slice(0, 10)}`);

  let totalIncome = 0;
  let totalExpenses = 0;
  let openingBalance = 0;

  Object.entries(logs).forEach(([dateStr, log]) => {
    if (!log) return;
    const logDate = new Date(dateStr + 'T00:00:00');

    if (logDate < monthStart) {
      if (Array.isArray(log.income)) {
        log.income.forEach(i => {
          openingBalance += parseFloat(i.amount) || 0;
        });
      }
      if (Array.isArray(log.expenses)) {
        log.expenses.forEach(e => {
          openingBalance -= parseFloat(e.amount) || 0;
        });
      }
      return;
    }

    if (Array.isArray(log.income)) {
      log.income.forEach(i => {
        totalIncome += parseFloat(i.amount) || 0;
      });
    }
    if (Array.isArray(log.expenses)) {
      log.expenses.forEach(e => {
        totalExpenses += parseFloat(e.amount) || 0;
      });
    }
  });

  const totalAvailable = openingBalance + totalIncome;
  const remaining = totalAvailable - totalExpenses;

  console.log('\n--- Calculated Dashboard Quick Metrics for August 2026 ---');
  console.log('Opening Balance (Rollover):', openingBalance.toFixed(3), 'TND');
  console.log('Total Income:', totalIncome.toFixed(3), 'TND');
  console.log('Total Available:', totalAvailable.toFixed(3), 'TND');
  console.log('Total Expenses:', totalExpenses.toFixed(3), 'TND');
  console.log('Remaining:', remaining.toFixed(3), 'TND');
}

computeMetrics().catch(console.error);

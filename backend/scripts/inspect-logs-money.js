const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const USER_ID = '2c65a27a-dd8a-4729-a3ea-168cff7e02df';

async function inspectLogs() {
  const raw = new DynamoDBClient({ region: 'us-east-1' });
  const doc = DynamoDBDocumentClient.from(raw);

  const res = await doc.send(new QueryCommand({
    TableName: 'HabitLogs',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': USER_ID }
  }));

  console.log(`Found ${res.Items.length} logs for ${USER_ID}`);
  let totalIncomeAll = 0;
  let totalExpensesAll = 0;

  for (const item of res.Items) {
    const d = item.data || {};
    const inc = d.income || [];
    const exp = d.expenses || [];
    if (inc.length > 0 || exp.length > 0) {
      console.log(`Date: ${item.date} | Income count: ${inc.length}, Expense count: ${exp.length}`);
      if (inc.length > 0) console.log('  Income:', JSON.stringify(inc));
      if (exp.length > 0) console.log('  Expenses:', JSON.stringify(exp));
    }
    inc.forEach(i => totalIncomeAll += parseFloat(i.amount) || 0);
    exp.forEach(e => totalExpensesAll += parseFloat(e.amount) || 0);
  }

  console.log(`\nTotals across all logs: Total Income = ${totalIncomeAll}, Total Expenses = ${totalExpensesAll}`);
}

inspectLogs().catch(console.error);

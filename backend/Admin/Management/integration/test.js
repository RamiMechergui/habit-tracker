const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = process.env.BASE_URL || 'http://nginx';
let authToken = '';
const TEST_ACCOUNT = {
  email: `qa_${Date.now()}@evolvia.com`,
  password: 'TestPassword123!',
  firstName: 'QA',
  lastName: 'Engineer'
};

let testsPassed = 0;
let testsFailed = 0;
const log = { success: [], failed: [] };
const communicationStatus = [];

function test(name, fn) {
  return fn()
    .then(() => {
      console.log(`  ✅ ${name}`);
      log.success.push(name);
      testsPassed++;
    })
    .catch(err => {
      console.log(`  ❌ ${name}`);
      console.log(`     Error: ${err.response?.data?.message || err.message}`);
      log.failed.push({ name, error: err.message });
      testsFailed++;
    });
}

function expect(val) {
  return {
    toBe: (expected) => { if (val !== expected) throw new Error(`Expected ${expected}, got ${val}`); },
    toEqual: (expected) => { if (JSON.stringify(val) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`); },
    toBeDefined: () => { if (val === undefined || val === null) throw new Error(`Expected value to be defined`); },
    toBeGreaterThan: (expected) => { if (!(val > expected)) throw new Error(`Expected ${val} > ${expected}`); }
  };
}

// ==================== 0. SYSTEM HEALTH CHECKS ====================
async function checkHealth() {
  console.log('\n🏥 Performing System Health Audit (Internal Network)...');
  const services = [
    { name: 'login', port: 5101 }, { name: 'register', port: 5102 }, 
    { name: 'logout', port: 5103 }, { name: 'verify', port: 5104 }, 
    { name: 'daily', port: 5105 }, { name: 'scoring', port: 5106 }, 
    { name: 'currentbook', port: 5107 }, { name: 'archives', port: 5108 }, 
    { name: 'settings', port: 5109 }, { name: 'categories', port: 5110 }, 
    { name: 'avatar', port: 5111 }, { name: 'profile', port: 5112 }, 
    { name: 'analytics', port: 5113 }
  ];
  
  for (const s of services) {
    await test(`Ping: ${s.name}`, async () => {
      // Check both /health and root/docs since some services use different conventions
      const res = await axios.get(`http://${s.name}:${s.port}/health`, { timeout: 2000, validateStatus: false });
      if (res.status === 404) {
        // Fallback to a simple root check
        const root = await axios.get(`http://${s.name}:${s.port}/`, { timeout: 2000, validateStatus: false });
        expect(root.status < 500).toBe(true);
      } else {
        expect(res.status).toBe(200);
      }
    });
  }
}

// ==================== 1. AUTHENTICATION LIFECYCLE ====================
async function testAuth() {
  console.log('\n🔐 Testing Authentication Lifecycle...');

  await test('Register new account', async () => {
    const res = await axios.post(`${BASE_URL}/api/register`, {
      email: TEST_ACCOUNT.email,
      password: TEST_ACCOUNT.password,
      confirmPassword: TEST_ACCOUNT.password
    });
    expect(res.status).toBe(201);
  });

  await test('Negative: Prevent duplicate registration', async () => {
    try {
      await axios.post(`${BASE_URL}/api/register`, {
        email: TEST_ACCOUNT.email,
        password: TEST_ACCOUNT.password,
        confirmPassword: TEST_ACCOUNT.password
      });
      throw new Error('Should have failed');
    } catch (err) {
      expect(err.response.status).toBe(400);
    }
  });

  await test('Login and obtain token', async () => {
    const res = await axios.post(`${BASE_URL}/api/login`, {
      email: TEST_ACCOUNT.email,
      password: TEST_ACCOUNT.password
    });
    expect(res.status).toBe(200);
    expect(res.data.email).toBe(TEST_ACCOUNT.email);
    authToken = res.data.token;
  });

  await test('Verify Session (Verify Service)', async () => {
    const res = await axios.get(`${BASE_URL}/api/verify`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    expect(res.status).toBe(200);
    expect(res.data.verified).toBe(true);
    expect(res.data.email).toBe(TEST_ACCOUNT.email);
  });
}

// ==================== 2. USER PERSONALIZATION ====================
async function testPersonalization() {
  console.log('\n🎨 Testing User Personalization...');

  await test('Update Profile Settings (Name & Theme)', async () => {
    const res = await axios.put(`${BASE_URL}/api/settings`, {
      firstName: TEST_ACCOUNT.firstName,
      lastName: TEST_ACCOUNT.lastName,
      theme: 'midnight'
    }, { headers: { Authorization: `Bearer ${authToken}` } });
    expect(res.status).toBe(200);
    expect(res.data.firstName).toBe(TEST_ACCOUNT.firstName);
  });

  await test('Categories Lifecycle (Add & List)', async () => {
    const categoryName = `Travel_${Date.now()}`;
    // Add
    const postRes = await axios.post(`${BASE_URL}/api/categories`, { category: categoryName }, { 
      headers: { Authorization: `Bearer ${authToken}` } 
    });
    expect(postRes.status).toBe(200);
    // List
    const getRes = await axios.get(`${BASE_URL}/api/categories`, { 
      headers: { Authorization: `Bearer ${authToken}` } 
    });
    expect(getRes.data.expenseCategories.includes(categoryName)).toBe(true);
  });
}

// ==================== 3. HABIT TRACKING & SCORING ====================
async function testHabits() {
  console.log('\n📊 Testing Habit Tracking & Scoring...');

  const today = new Date().toISOString().split('T')[0];
  const complexLog = {
    morning: { wakeTime: '05:00', meditate: true, shower: true },
    night: { gym: true, noSugar: true },
    bad: { smoking: { checked: true } },
    totalScore: 95,
    rank: 'S',
    expenses: [{ category: 'Food', amount: 50 }]
  };

  await test('Save Detailed Daily Log', async () => {
    const res = await axios.post(`${BASE_URL}/api/daily/${today}`, complexLog, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    expect(res.status).toBe(200);
  });

  await test('Calculate Score via Scoring Engine', async () => {
    const res = await axios.post(`${BASE_URL}/api/scoring/calculate`, { data: complexLog }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    expect(res.status).toBe(200);
    expect(res.data.totalScore).toBeDefined();
  });
}

// ==================== 4. READING & ARCHIVES ====================
async function testReading() {
  console.log('\n📚 Testing Reading Workflow...');

  const bookData = { bookName: 'The Alchemist', targetPages: 200 };

  await test('Set Current Book', async () => {
    const res = await axios.post(`${BASE_URL}/api/currentbook`, bookData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    expect(res.status).toBe(200);
    expect(res.data.bookName).toBe(bookData.bookName);
  });

  await test('Archive Finished Book', async () => {
    // Archive
    const archiveRes = await axios.post(`${BASE_URL}/api/archives`, {
      ...bookData,
      startDate: '2023-01-01',
      finalPage: 200
    }, { headers: { Authorization: `Bearer ${authToken}` } });
    expect(archiveRes.status).toBe(200);
    
    // Verify
    const getRes = await axios.get(`${BASE_URL}/api/archives`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const archived = getRes.data.archivedBooks.find(b => b.bookName === bookData.bookName);
    expect(archived).toBeDefined();
  });
}

// ==================== 5. DATA PIPELINE (DAILY -> ANALYTICS) ====================
async function testAnalyticsPipeline() {
  console.log('\n📡 Testing Data Pipeline (Daily ➔ Analytics)...');
  const date = '2025-12-31';
  const score = 88;

  await test('Trigger Ingestion', async () => {
    await axios.post(`${BASE_URL}/api/daily/${date}`, { totalScore: score, rank: 'A' }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
  });

  // Wait for async pipe
  await new Promise(r => setTimeout(r, 1000));

  await test('Verify Ingested Stats', async () => {
    const res = await axios.get(`${BASE_URL}/api/analytics/weekly/${date}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const entry = res.data.find(d => d.date === date);
    expect(entry).toBeDefined();
    expect(entry.totalScore).toBe(score);
    communicationStatus.push({ from: 'Daily', to: 'Analytics', type: 'Data Notification', status: 'SUCCESS' });
  });
}

// ==================== RUN ALL ====================
async function run() {
  console.log('🚀 INITIALIZING COMPREHENSIVE INTEGRATION SUITE');
  console.log('==============================================');

  try {
    await checkHealth();
    await testAuth();
    await testPersonalization();
    await testHabits();
    await testReading();
    await testAnalyticsPipeline();

    console.log('\n' + '='.repeat(60));
    console.log(`🏁 TESTS COMPLETED: ${testsPassed} Passed | ${testsFailed} Failed`);
    console.log('='.repeat(60));

    if (testsFailed > 0) {
      console.log('\n❌ BUILD FAILED: Coverage gaps detected.');
      process.exit(1);
    } else {
      console.log('\n✅ BUILD SUCCESS: 100% Feature Compliance Verified.');
      process.exit(0);
    }
  } catch (err) {
    console.error('\n💥 FATAL CRASH:', err.message);
    process.exit(1);
  }
}

run();
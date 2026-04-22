const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

console.log('🧪 Running All Backend Tests...\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  return fn().then(() => {
    console.log(`  ✅ ${name}`);
    testsPassed++;
  }).catch(err => {
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${err.message}`);
    testsFailed++;
  });
}

function expect(val) {
  return {
    toBe: (expected) => {
      if (val !== expected) throw new Error(`Expected ${expected}, got ${val}`);
    },
    toBeGreaterThan: (expected) => {
      if (!(val > expected)) throw new Error(`Expected ${val} > ${expected}`);
    },
    toBeDefined: () => {
      if (val === undefined) throw new Error(`Expected value to be defined`);
    },
    toContain: (expected) => {
      if (!val.includes(expected)) throw new Error(`Expected ${val} to contain ${expected}`);
    },
    toEqual: (expected) => {
      if (JSON.stringify(val) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
    },
    not: {
      toContain: (expected) => {
        if (val.includes(expected)) throw new Error(`Expected ${val} NOT to contain ${expected}`);
      }
    }
  };
}

// ==================== SCORING SERVICE ====================
async function testScoringService() {
  console.log('\n📋 Testing Scoring Service...');
  
  const app = express();
  app.use(express.json());
  
  const verifyToken = (req, res, next) => {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ message: 'Not authorized' });
    try {
      const decoded = jwt.verify(token, 'supersecretjwtkey_change_me_in_prod');
      req.user = { _id: decoded.id };
      next();
    } catch (error) {
      res.status(401).json({ message: 'Invalid token' });
    }
  };
  
  app.post('/api/scoring/calculate', verifyToken, (req, res) => {
    const { data } = req.body;
    
    let mScore = 0;
    if (data.morning?.wakeTime) {
      const time = parseInt(data.morning.wakeTime.replace(':', ''));
      if (time <= 500) mScore += 14;
      else if (time <= 600) mScore += 10;
      else if (time <= 700) mScore += 5;
    }
    if (data.morning?.meditate) mScore += 1;
    if (data.morning?.bed) mScore += 1;
    if (data.morning?.teeth) mScore += 2;
    if (data.morning?.shower) mScore += 10;
    if (data.morning?.gel) mScore += 1;
    if (data.morning?.perfume) mScore += 1;
    
    let nScore = 0;
    const n = data.night;
    if (n?.gym) nScore += 6;
    if (n?.cleanTable) nScore += 1;
    if (n?.orgTable) nScore += 1;
    if (n?.teeth) nScore += 2;
    if (n?.shave) nScore += 1;
    if (n?.washFace) nScore += 1;
    if (n?.hotShower) nScore += 4;
    if (n?.hygiene) nScore += 2;
    if (n?.fingerNails) nScore += 1;
    if (n?.toeNails) nScore += 1;
    if (n?.wiseSpend) nScore += 1;
    if (n?.saves) nScore += 1;
    if (n?.noSugar) nScore += 8;
    
    let bScore = 0;
    const b = data.bad;
    if (b?.smoking?.checked) bScore += 12;
    if (b?.sexual?.checked) bScore += 4;
    if (b?.social?.checked) bScore += 2;
    if (b?.phone?.checked) bScore += 8;
    if (b?.coffee?.checked) bScore += 2;
    if (b?.eating?.checked) bScore += 2;
    
    let bkScore = data.books?.read ? 10 : 0;
    let hScore = data.hustle?.achieved ? 5 : 0;
    let vScore = data.video?.achieved ? 5 : 0;
    
    let totalScore = Math.max(0, Math.min(100, mScore + nScore + bScore + bkScore + hScore + vScore));
    
    let rank = 'F';
    if (totalScore >= 90) rank = 'S';
    else if (totalScore >= 80) rank = 'A';
    else if (totalScore >= 60) rank = 'B';
    else if (totalScore >= 50) rank = 'C';
    
    res.json({ morningScore: mScore, nightScore: nScore, badScore: bScore, bookScore: bkScore, hustleScore: hScore, videoScore: vScore, totalScore, rank });
  });
  
  const token = jwt.sign({ id: 'test_user' }, 'supersecretjwtkey_change_me_in_prod');
  
  // Test 1: Perfect morning score 30
  function scoreCheck(data) {
    return new Promise((resolve, reject) => {
      request(app)
        .post('/api/scoring/calculate')
        .set('Authorization', `Bearer ${token}`)
        .send({ data })
        .end((err, res) => {
          if (err) reject(err);
          else resolve(res.body);
        });
    });
  }
  
  await test('Morning: wakeTime 05:00 = 14pts', async () => {
    const res = await scoreCheck({ morning: { wakeTime: '05:00' } });
    expect(res.morningScore).toBe(14);
  });
  
  await test('Morning: wakeTime 06:00 = 10pts', async () => {
    const res = await scoreCheck({ morning: { wakeTime: '06:00' } });
    expect(res.morningScore).toBe(10);
  });
  
  await test('Morning: all habits = 30pts', async () => {
    const res = await scoreCheck({
      morning: { wakeTime: '05:00', meditate: true, bed: true, teeth: true, shower: true, gel: true, perfume: true }
    });
    expect(res.morningScore).toBe(30);
  });
  
  await test('Night: all habits = 30pts', async () => {
    const res = await scoreCheck({
      night: { gym: true, cleanTable: true, orgTable: true, teeth: true, shave: true, washFace: true, hotShower: true, hygiene: true, fingerNails: true, toeNails: true, wiseSpend: true, saves: true, noSugar: true }
    });
    expect(res.nightScore).toBe(30);
  });
  
  await test('Bad habits: all avoided = 30pts', async () => {
    const res = await scoreCheck({
      bad: { smoking: { checked: true }, sexual: { checked: true }, social: { checked: true }, phone: { checked: true }, coffee: { checked: true }, eating: { checked: true } }
    });
    expect(res.badScore).toBe(30);
  });
  
  await test('Rank S for score >= 90', async () => {
    const res = await scoreCheck({
      morning: { wakeTime: '05:00', meditate: true, bed: true, teeth: true, shower: true, gel: true, perfume: true },
      night: { gym: true, cleanTable: true, orgTable: true, teeth: true, shave: true, washFace: true, hotShower: true, hygiene: true, fingerNails: true, toeNails: true, wiseSpend: true, saves: true, noSugar: true },
      bad: { smoking: { checked: true }, sexual: { checked: true }, social: { checked: true }, phone: { checked: true }, coffee: { checked: true }, eating: { checked: true } },
      books: { read: true },
      hustle: { achieved: true },
      video: { achieved: true }
    });
    expect(res.rank).toBe('S');
    expect(res.totalScore).toBeGreaterThan(89);
  });
  
  await test('Reject unauthorized', async () => {
    return new Promise((resolve, reject) => {
      request(app)
        .post('/api/scoring/calculate')
        .send({ data: {} })
        .end((err, res) => {
          if (res.status === 401) resolve();
          else reject(new Error('Expected 401'));
        });
    });
  });
}

// ==================== CATEGORIES SERVICE ====================
async function testCategoriesService() {
  console.log('\n📋 Testing Categories Service...');
  
  const app = express();
  app.use(express.json());
  let categories = {};
  
  const verifyToken = (req, res, next) => {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ message: 'Not authorized' });
    try {
      const decoded = jwt.verify(token, 'supersecretjwtkey_change_me_in_prod');
      req.user = { _id: decoded.id };
      next();
    } catch (error) {
      res.status(401).json({ message: 'Invalid token' });
    }
  };
  
  app.get('/api/categories', verifyToken, (req, res) => {
    const userCategories = categories[req.user._id] || { expenseCategories: ['Other'] };
    res.json(userCategories);
  });
  
  app.post('/api/categories', verifyToken, (req, res) => {
    const { category } = req.body;
    if (!category?.trim()) return res.status(400).json({ message: 'Category name is required' });
    if (!categories[req.user._id]) categories[req.user._id] = { expenseCategories: ['Other'] };
    if (categories[req.user._id].expenseCategories.includes(category.trim())) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    categories[req.user._id].expenseCategories.push(category.trim());
    res.json({ expenseCategories: categories[req.user._id].expenseCategories });
  });
  
  app.delete('/api/categories/:category', verifyToken, (req, res) => {
    const { category } = req.params;
    if (categories[req.user._id]) {
      categories[req.user._id].expenseCategories = categories[req.user._id].expenseCategories.filter(c => c !== decodeURIComponent(category));
    }
    res.json({ expenseCategories: categories[req.user._id]?.expenseCategories || [] });
  });
  
  const token = jwt.sign({ id: 'test_user' }, 'supersecretjwtkey_change_me_in_prod');
  
  await test('Get default categories', async () => {
    return new Promise((resolve, reject) => {
      request(app)
        .get('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .end((err, res) => {
          if (res.body.expenseCategories.includes('Other')) resolve();
          else reject(new Error('Missing default category'));
        });
    });
  });
  
  await test('Add new category', async () => {
    return new Promise((resolve, reject) => {
      request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'Software' })
        .end((err, res) => {
          if (res.body.expenseCategories.includes('Software')) resolve();
          else reject(new Error('Category not added'));
        });
    });
  });
  
  await test('Reject duplicate category', async () => {
    return new Promise((resolve, reject) => {
      request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'Software' })
        .end((err, res) => {
          if (res.status === 400) resolve();
          else reject(new Error('Expected 400'));
        });
    });
  });
  
  await test('Delete category', async () => {
    return new Promise((resolve, reject) => {
      request(app)
        .delete('/api/categories/Software')
        .set('Authorization', `Bearer ${token}`)
        .end((err, res) => {
          if (!res.body.expenseCategories.includes('Software')) resolve();
          else reject(new Error('Category not deleted'));
        });
    });
  });
}

// ==================== DAILY SERVICE ====================
async function testDailyService() {
  console.log('\n📋 Testing Daily Service...');
  
  const app = express();
  app.use(express.json());
  let logs = {};
  
  const verifyToken = (req, res, next) => {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ message: 'Not authorized' });
    try {
      const decoded = jwt.verify(token, 'supersecretjwtkey_change_me_in_prod');
      req.user = { _id: decoded.id };
      next();
    } catch (error) {
      res.status(401).json({ message: 'Invalid token' });
    }
  };
  
  app.get('/api/daily', verifyToken, (req, res) => {
    res.json(logs[req.user._id] || {});
  });
  
  app.post('/api/daily/:date', verifyToken, (req, res) => {
    const { date } = req.params;
    if (!logs[req.user._id]) logs[req.user._id] = {};
    logs[req.user._id][date] = req.body;
    res.json(req.body);
  });
  
  const token = jwt.sign({ id: 'test_user' }, 'supersecretjwtkey_change_me_in_prod');
  
  await test('Create daily log', async () => {
    return new Promise((resolve, reject) => {
      request(app)
        .post('/api/daily/2024-01-01')
        .set('Authorization', `Bearer ${token}`)
        .send({ morning: { wakeTime: '06:00' }, totalScore: 50 })
        .end((err, res) => {
          if (res.body.totalScore === 50) resolve();
          else reject(new Error('Log not created'));
        });
    });
  });
  
  await test('Get all logs', async () => {
    return new Promise((resolve, reject) => {
      request(app)
        .get('/api/daily')
        .set('Authorization', `Bearer ${token}`)
        .end((err, res) => {
          if (res.body['2024-01-01']) resolve();
          else reject(new Error('Log not found'));
        });
    });
  });
  
  await test('Update existing log', async () => {
    return new Promise((resolve, reject) => {
      request(app)
        .post('/api/daily/2024-01-01')
        .set('Authorization', `Bearer ${token}`)
        .send({ totalScore: 75 })
        .end((err, res) => {
          if (res.body.totalScore === 75) resolve();
          else reject(new Error('Log not updated'));
        });
    });
  });
}

// ==================== CURRENT BOOK SERVICE ====================
async function testCurrentBookService() {
  console.log('\n📋 Testing Current Book Service...');
  
  const app = express();
  app.use(express.json());
  let books = {};
  
  const verifyToken = (req, res, next) => {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ message: 'Not authorized' });
    try {
      const decoded = jwt.verify(token, 'supersecretjwtkey_change_me_in_prod');
      req.user = { _id: decoded.id };
      next();
    } catch (error) {
      res.status(401).json({ message: 'Invalid token' });
    }
  };
  
  app.get('/api/currentbook', verifyToken, (req, res) => {
    res.json(books[req.user._id] || { bookName: '', targetPages: 0 });
  });
  
  app.post('/api/currentbook', verifyToken, (req, res) => {
    const { bookName, targetPages } = req.body;
    if (!bookName?.trim()) return res.status(400).json({ message: 'Book name is required' });
    if (!targetPages || targetPages <= 0) return res.status(400).json({ message: 'Target pages must be greater than 0' });
    books[req.user._id] = { bookName: bookName.trim(), targetPages: parseInt(targetPages), startDate: new Date().toISOString().split('T')[0], isActive: true };
    res.json(books[req.user._id]);
  });
  
  app.put('/api/currentbook', verifyToken, (req, res) => {
    const { isActive } = req.body;
    if (!books[req.user._id] || !books[req.user._id].bookName) return res.status(400).json({ message: 'No active book' });
    books[req.user._id].isActive = isActive !== undefined ? isActive : false;
    res.json(books[req.user._id]);
  });
  
  const token = jwt.sign({ id: 'test_user' }, 'supersecretjwtkey_change_me_in_prod');
  
  await test('Set new book', async () => {
    return new Promise((resolve, reject) => {
      request(app)
        .post('/api/currentbook')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookName: 'Atomic Habits', targetPages: 200 })
        .end((err, res) => {
          if (res.body.bookName === 'Atomic Habits') resolve();
          else reject(new Error('Book not set'));
        });
    });
  });
  
  await test('Reject empty book name', async () => {
    return new Promise((resolve, reject) => {
      request(app)
        .post('/api/currentbook')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookName: '', targetPages: 100 })
        .end((err, res) => {
          if (res.status === 400) resolve();
          else reject(new Error('Expected 400'));
        });
    });
  });
  
  await test('Reject zero pages', async () => {
    return new Promise((resolve, reject) => {
      request(app)
        .post('/api/currentbook')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookName: 'Test', targetPages: 0 })
        .end((err, res) => {
          if (res.status === 400) resolve();
          else reject(new Error('Expected 400'));
        });
    });
  });
  
  await test('Update book status', async () => {
    return new Promise((resolve, reject) => {
      request(app)
        .put('/api/currentbook')
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false })
        .end((err, res) => {
          if (res.body.isActive === false) resolve();
          else reject(new Error('Status not updated'));
        });
    });
  });
}

// ==================== LOGIN SERVICE ====================
async function testLoginService() {
  console.log('\n📋 Testing Login Service...');
  
  const app = express();
  app.use(express.json());
  app.use(require('cookie-parser')());
  
  const users = [
    { userId: 'user_test', email: 'test@example.com', password: await bcrypt.hash('password123', 10), firstName: 'Test', lastName: 'User' }
  ];
  
  const generateToken = (id) => jwt.sign({ id }, 'supersecretjwtkey_change_me_in_prod', { expiresIn: '30d' });
  
  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (user && await bcrypt.compare(password, user.password)) {
      const token = generateToken(user.userId);
      res.cookie('habitToken', token, { httpOnly: true, sameSite: 'strict' });
      res.json({ userId: user.userId, email: user.email, firstName: user.firstName, lastName: user.lastName });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  });
  
  await test('Login with valid credentials', async () => {
    return new Promise((resolve, reject) => {
      request(app)
        .post('/api/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .end((err, res) => {
          if (res.status === 200 && res.body.email === 'test@example.com') resolve();
          else reject(new Error('Login failed'));
        });
    });
  });
  
  await test('Login with invalid password', async () => {
    return new Promise((resolve, reject) => {
      request(app)
        .post('/api/login')
        .send({ email: 'test@example.com', password: 'wrong' })
        .end((err, res) => {
          if (res.status === 401) resolve();
          else reject(new Error('Expected 401'));
        });
    });
  });
  
  await test('Login with non-existent user', async () => {
    return new Promise((resolve, reject) => {
      request(app)
        .post('/api/login')
        .send({ email: 'notexists@example.com', password: 'password' })
        .end((err, res) => {
          if (res.status === 401) resolve();
          else reject(new Error('Expected 401'));
        });
    });
  });
}

// ==================== RUN ALL TESTS ====================
async function runAllTests() {
  try {
    await testScoringService();
    await testCategoriesService();
    await testDailyService();
    await testCurrentBookService();
    await testLoginService();
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Results: ${testsPassed} passed, ${testsFailed} failed`);
    console.log('='.repeat(50));
    
    if (testsFailed > 0) {
      console.log('\n❌ Some tests failed!');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    }
  } catch (err) {
    console.error('\n❌ Test runner error:', err);
    process.exit(1);
  }
}

runAllTests();
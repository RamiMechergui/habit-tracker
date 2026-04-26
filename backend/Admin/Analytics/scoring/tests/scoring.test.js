const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

let app;

beforeAll(() => {
  app = express();
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

    res.json({
      morningScore: mScore,
      nightScore: nScore,
      badScore: bScore,
      bookScore: bkScore,
      hustleScore: hScore,
      videoScore: vScore,
      totalScore,
      rank
    });
  });
});

const token = jwt.sign({ id: 'test_user' }, 'supersecretjwtkey_change_me_in_prod');

describe('POST /api/scoring/calculate', () => {
  it('should calculate score for perfect morning', async () => {
    const res = await request(app)
      .post('/api/scoring/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        data: {
          morning: { wakeTime: '05:00', meditate: true, bed: true, teeth: true, shower: true, gel: true, perfume: true }
        }
      })
      .expect(200);

    expect(res.body.morningScore).toBe(30);
    expect(res.body.totalScore).toBeGreaterThan(0);
  });

  it('should calculate night habits score', async () => {
    const res = await request(app)
      .post('/api/scoring/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        data: {
          night: { gym: true, cleanTable: true, teeth: true, hotShower: true, hygiene: true, noSugar: true }
        }
      })
      .expect(200);

    expect(res.body.nightScore).toBeGreaterThan(0);
  });

  it('should calculate bad habits avoidance', async () => {
    const res = await request(app)
      .post('/api/scoring/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        data: {
          bad: { smoking: { checked: true }, phone: { checked: true } }
        }
      })
      .expect(200);

    expect(res.body.badScore).toBe(20); // 12 + 8
  });

  it('should return rank S for score >= 90', async () => {
    const res = await request(app)
      .post('/api/scoring/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        data: {
          morning: { wakeTime: '05:00', meditate: true, bed: true, teeth: true, shower: true, gel: true, perfume: true },
          night: { gym: true, cleanTable: true, orgTable: true, teeth: true, shave: true, washFace: true, hotShower: true, hygiene: true, fingerNails: true, toeNails: true, wiseSpend: true, saves: true, noSugar: true },
          bad: { smoking: { checked: true }, sexual: { checked: true }, social: { checked: true }, phone: { checked: true }, coffee: { checked: true }, eating: { checked: true } },
          books: { read: true },
          hustle: { achieved: true },
          video: { achieved: true }
        }
      })
      .expect(200);

    expect(res.body.rank).toBe('S');
    expect(res.body.totalScore).toBeGreaterThanOrEqual(90);
  });

  it('should reject unauthorized request', async () => {
    const res = await request(app)
      .post('/api/scoring/calculate')
      .send({ data: {} })
      .expect(401);
  });
});
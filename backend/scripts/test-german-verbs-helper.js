/**
 * test-german-verbs-helper.js
 * Verification test suite for German verb stem/ending splitting and JSON validation.
 */

const assert = require('assert');

// Simple emulation of the exported functions for node CJS testing
function normalizePronounKey(key) {
  if (!key) return '';
  const clean = key.trim().toLowerCase();
  if (clean === 'er/sie/es' || clean === 'ersiees') return 'erSieEs';
  if (clean === 'sie/sie' || clean === 'sie') return 'Sie';
  return clean;
}

const IRREGULAR_SPLITS = {
  sein: {
    ich: { stem: 'bin', ending: '' },
    du: { stem: 'bi', ending: 'st' },
    erSieEs: { stem: 'i', ending: 'st' },
    wir: { stem: 'sind', ending: '' },
    ihr: { stem: 'sei', ending: 'd' },
    Sie: { stem: 'sind', ending: '' },
  },
  haben: {
    ich: { stem: 'hab', ending: 'e' },
    du: { stem: 'ha', ending: 'st' },
    erSieEs: { stem: 'ha', ending: 't' },
    wir: { stem: 'hab', ending: 'en' },
    ihr: { stem: 'hab', ending: 't' },
    Sie: { stem: 'hab', ending: 'en' },
  },
  wissen: {
    ich: { stem: 'weiß', ending: '' },
    du: { stem: 'weiß', ending: 't' },
    erSieEs: { stem: 'weiß', ending: '' },
    wir: { stem: 'wiss', ending: 'en' },
    ihr: { stem: 'wiss', ending: 't' },
    Sie: { stem: 'wiss', ending: 'en' },
  },
};

function splitVerbConjugation(word = '', pronoun = '', infinitive = '', overrides = null) {
  if (!word || typeof word !== 'string') {
    return { stem: '', ending: '', particle: '' };
  }

  const pKey = normalizePronounKey(pronoun);
  const cleanWord = word.trim();

  if (overrides && typeof overrides === 'object') {
    const directOverride = overrides[pKey] || overrides[pronoun] || overrides[pronoun.toLowerCase()];
    if (directOverride && typeof directOverride === 'object' && directOverride.stem !== undefined) {
      return {
        stem: directOverride.stem,
        ending: directOverride.ending || '',
        particle: directOverride.particle || ''
      };
    }
  }

  let verbPart = cleanWord;
  let particle = '';
  const spaceIdx = cleanWord.indexOf(' ');
  if (spaceIdx > 0) {
    verbPart = cleanWord.slice(0, spaceIdx);
    particle = cleanWord.slice(spaceIdx + 1);
  }

  const cleanInf = (infinitive || '').trim().toLowerCase();
  const infStem = cleanInf.replace(/(en|n)$/, '');
  const infBaseStem = infStem.replace(/^(an|auf|ab|aus|be|ein|er|ge|mit|nach|ver|vor|zer|zu|zurück|weg)/, '');

  if (IRREGULAR_SPLITS[cleanInf] && IRREGULAR_SPLITS[cleanInf][pKey]) {
    const fixed = IRREGULAR_SPLITS[cleanInf][pKey];
    return { stem: fixed.stem, ending: fixed.ending, particle };
  }

  let candidateEndings = [];
  if (pKey === 'ich') {
    candidateEndings = ['e'];
  } else if (pKey === 'du') {
    const isSibilantStem = Boolean(infBaseStem && /[sßzx]$/.test(infBaseStem));
    if (isSibilantStem) {
      candidateEndings = ['t', 'est', 'st'];
    } else {
      candidateEndings = ['est', 'st', 't'];
    }
  } else if (pKey === 'erSieEs') {
    candidateEndings = ['et', 't'];
  } else if (pKey === 'wir' || pKey === 'Sie') {
    candidateEndings = ['en', 'n'];
  } else if (pKey === 'ihr') {
    candidateEndings = ['et', 't'];
  }

  for (const ending of candidateEndings) {
    if (verbPart.length > ending.length && verbPart.endsWith(ending)) {
      const candidateStem = verbPart.slice(0, -ending.length);
      if (candidateStem.length > 0) {
        return { stem: candidateStem, ending, particle };
      }
    }
  }

  if ((pKey === 'ich' || pKey === 'erSieEs') && verbPart.length > 0) {
    return { stem: verbPart, ending: '', particle };
  }

  return { stem: verbPart, ending: '', particle };
}

function validateVerbJson(jsonString = '', existingVerbs = []) {
  if (!jsonString || !jsonString.trim()) {
    return { isValid: false, errors: ['JSON input is empty.'] };
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return { isValid: false, errors: [`JSON Syntax Error: ${err.message}`] };
  }
  const rawList = Array.isArray(parsed) ? parsed : [parsed];
  const errors = [];
  const warnings = [];
  const existingSet = new Set((existingVerbs || []).map(v => (v.infinitive || '').trim().toLowerCase()));

  rawList.forEach((raw, idx) => {
    if (!raw.infinitive?.trim()) errors.push(`Item #${idx + 1} missing infinitive`);
    if (!(raw.translation || raw.meaning)?.trim()) errors.push(`Item #${idx + 1} missing translation`);
    if (!raw.conjugation) errors.push(`Item #${idx + 1} missing conjugation`);
    if (raw.infinitive && existingSet.has(raw.infinitive.trim().toLowerCase())) {
      warnings.push(`Warning: Verb ${raw.infinitive} already exists`);
    }
  });

  return { isValid: errors.length === 0, errors, warnings };
}

console.log('--- Running German Verbs Test Suite ---\n');

// 1. Regular verb: machen
console.log('1. Testing Regular Verb: machen');
const m_ich = splitVerbConjugation('mache', 'ich', 'machen');
assert.strictEqual(m_ich.stem, 'mach');
assert.strictEqual(m_ich.ending, 'e');

const m_du = splitVerbConjugation('machst', 'du', 'machen');
assert.strictEqual(m_du.stem, 'mach');
assert.strictEqual(m_du.ending, 'st');

const m_er = splitVerbConjugation('macht', 'er/sie/es', 'machen');
assert.strictEqual(m_er.stem, 'mach');
assert.strictEqual(m_er.ending, 't');

const m_wir = splitVerbConjugation('machen', 'wir', 'machen');
assert.strictEqual(m_wir.stem, 'mach');
assert.strictEqual(m_wir.ending, 'en');
console.log('  ✓ Regular verb "machen" passes all stem/ending checks');

// 2. Stem-changing verb: fahren (a -> ä)
console.log('2. Testing Stem-Changing Verb: fahren');
const f_du = splitVerbConjugation('fährst', 'du', 'fahren');
assert.strictEqual(f_du.stem, 'fähr');
assert.strictEqual(f_du.ending, 'st');

const f_er = splitVerbConjugation('fährt', 'er/sie/es', 'fahren');
assert.strictEqual(f_er.stem, 'fähr');
assert.strictEqual(f_er.ending, 't');
console.log('  ✓ Stem-changing "fahren" (du fährst, er fährt) successfully extracts fähr + st/t');

// 3. Dental stem: arbeiten (e-insertion)
console.log('3. Testing Dental Stem Verb: arbeiten');
const a_du = splitVerbConjugation('arbeitest', 'du', 'arbeiten');
assert.strictEqual(a_du.stem, 'arbeit');
assert.strictEqual(a_du.ending, 'est');

const a_er = splitVerbConjugation('arbeitet', 'erSieEs', 'arbeiten');
assert.strictEqual(a_er.stem, 'arbeit');
assert.strictEqual(a_er.ending, 'et');
console.log('  ✓ Dental stem "arbeiten" (arbeitest, arbeitet) extracts arbeit + est/et');

// 4. Sibilant stem: reisen (-s ending stem, du takes -t)
console.log('4. Testing Sibilant Stem Verb: reisen');
const r_du = splitVerbConjugation('reist', 'du', 'reisen');
assert.strictEqual(r_du.stem, 'reis');
assert.strictEqual(r_du.ending, 't');
console.log('  ✓ Sibilant stem "reisen" (du reist) extracts reis + t');

// 5. Irregular verb: sein
console.log('5. Testing Irregular Verb: sein');
const s_ich = splitVerbConjugation('bin', 'ich', 'sein');
assert.strictEqual(s_ich.stem, 'bin');
assert.strictEqual(s_ich.ending, '');

const s_du = splitVerbConjugation('bist', 'du', 'sein');
assert.strictEqual(s_du.stem, 'bi');
assert.strictEqual(s_du.ending, 'st');

const s_er = splitVerbConjugation('ist', 'erSieEs', 'sein');
assert.strictEqual(s_er.stem, 'i');
assert.strictEqual(s_er.ending, 'st');
console.log('  ✓ Irregular "sein" correctly handled');

// 6. Explicit override test
console.log('6. Testing Explicit Overrides');
const custom = splitVerbConjugation('fährst', 'du', 'fahren', { du: { stem: 'fähr', ending: 'st' } });
assert.strictEqual(custom.stem, 'fähr');
assert.strictEqual(custom.ending, 'st');
console.log('  ✓ Explicit user overrides prioritized correctly');

// 7. Separable verb particle
console.log('7. Testing Separable Verb: aufstehen');
const sep = splitVerbConjugation('stehst auf', 'du', 'aufstehen');
assert.strictEqual(sep.stem, 'steh');
assert.strictEqual(sep.ending, 'st');
assert.strictEqual(sep.particle, 'auf');
console.log('  ✓ Separable particle preserved correctly ("steh" + "st" + "auf")');

// 8. JSON Validation Test: Valid sample
console.log('8. Testing JSON Validation');
const sampleValid = JSON.stringify({
  infinitive: "machen",
  translation: "to do / to make",
  type: "regular",
  level: "A1",
  conjugation: {
    "ich": "mache",
    "du": "machst",
    "er/sie/es": "macht",
    "wir": "machen",
    "ihr": "macht",
    "sie/Sie": "machen"
  },
  pastParticiple: "gemacht",
  auxiliary: "haben"
});

const val1 = validateVerbJson(sampleValid);
assert.strictEqual(val1.isValid, true);
assert.strictEqual(val1.errors.length, 0);
console.log('  ✓ Valid JSON recognized and validated');

// 9. JSON Validation Test: Missing required field
const sampleInvalid = JSON.stringify({
  infinitive: "lernen"
});
const val2 = validateVerbJson(sampleInvalid);
assert.strictEqual(val2.isValid, false);
assert(val2.errors.length >= 2);
console.log('  ✓ Missing translation & conjugation caught as errors');

// 10. Duplicate warning test
const val3 = validateVerbJson(sampleValid, [{ infinitive: 'machen' }]);
assert.strictEqual(val3.isValid, true);
assert.strictEqual(val3.warnings.length, 1);
assert(val3.warnings[0].includes('already exists'));
console.log('  ✓ Duplicate infinitive triggers non-blocking warning');

console.log('\n--- All 10 Test Cases Passed Successfully! ---');

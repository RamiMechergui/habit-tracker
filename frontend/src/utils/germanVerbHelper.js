/**
 * germanVerbHelper.js
 * Morphological stem-ending analyzer, JSON validation, and templates for German verbs.
 */

export const VERB_JSON_EXAMPLE = {
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
  auxiliary: "haben",
  examples: [
    {
      "german": "Ich mache meine Hausaufgaben.",
      "english": "I do my homework."
    }
  ]
};

export const VERB_JSON_EXAMPLE_STRING = JSON.stringify(VERB_JSON_EXAMPLE, null, 2);

export const VERB_FIELD_DESCRIPTIONS = [
  { field: "infinitive", required: true, type: "string", desc: "The base form of the German verb (e.g. \"machen\", \"fahren\")." },
  { field: "translation", required: true, type: "string", desc: "English meaning (e.g. \"to do / to make\"). Also accepts \"meaning\"." },
  { field: "conjugation", required: true, type: "object", desc: "Present tense conjugations for: ich, du, er/sie/es, wir, ihr, sie/Sie." },
  { field: "type", required: false, type: "string", desc: "Verb classification: \"regular\", \"irregular\", \"stem-changing\", \"separable\", \"modal\"." },
  { field: "level", required: false, type: "string", desc: "Proficiency level (e.g. \"A1\", \"A2\", \"B1\"). Default: \"A1\"." },
  { field: "pastParticiple", required: false, type: "string", desc: "Partizip II form for the Perfekt tense (e.g. \"gemacht\", \"gefahren\")." },
  { field: "auxiliary", required: false, type: "string", desc: "Auxiliary verb for Perfekt tense: \"haben\" or \"sein\"." },
  { field: "examples", required: false, type: "array", desc: "List of example sentences with \"german\" and \"english\" properties." },
  { field: "stemEndingOverrides", required: false, type: "object", desc: "Optional manual split overrides: { \"du\": { \"stem\": \"fähr\", \"ending\": \"st\" } }." }
];

/**
 * Standardizes pronoun keys across camelCase and slash representations.
 */
export function normalizePronounKey(key) {
  if (!key) return '';
  const clean = key.trim().toLowerCase();
  if (clean === 'er/sie/es' || clean === 'ersiees') return 'erSieEs';
  if (clean === 'sie/sie' || clean === 'sie') return 'Sie';
  return clean;
}

/**
 * Display labels for each pronoun key.
 */
export const PRONOUN_ORDER = [
  { key: 'ich', label: 'ich', defaultEnding: 'e' },
  { key: 'du', label: 'du', defaultEnding: 'st' },
  { key: 'erSieEs', label: 'er/sie/es', defaultEnding: 't' },
  { key: 'wir', label: 'wir', defaultEnding: 'en' },
  { key: 'ihr', label: 'ihr', defaultEnding: 't' },
  { key: 'Sie', label: 'sie/Sie', defaultEnding: 'en' },
];

/**
 * Irregular/modal lookup dictionary for verbs with unique conjugations
 */
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

/**
 * Splits a German conjugated verb form into stem and ending.
 * Handles:
 * 1. Explicit user-provided overrides
 * 2. Irregular dictionaries (sein, haben, wissen)
 * 3. Dental/nasal stems (-d, -t, consonant+n/m -> -est, -et)
 * 4. Sibilant stems (-s, -ß, -z -> du ending -t)
 * 5. Stem-vowel changers (fahren -> fähr-st, lesen -> lies-t, geben -> gib-st)
 * 6. Modal verbs (ich/erSieEs ending -∅)
 * 7. Separable verb particles (e.g. "steht auf" -> stem: "steh", ending: "t", particle: "auf")
 *
 * @param {string} word - The conjugated form (e.g. "machst", "fährst", "arbeitet")
 * @param {string} pronoun - Pronoun key (e.g. "du", "erSieEs", "er/sie/es")
 * @param {string} infinitive - Verb infinitive (e.g. "machen", "fahren")
 * @param {object} overrides - Optional explicit overrides
 * @returns {{ stem: string, ending: string, particle: string }}
 */
export function splitVerbConjugation(word = '', pronoun = '', infinitive = '', overrides = null) {
  if (!word || typeof word !== 'string') {
    return { stem: '', ending: '', particle: '' };
  }

  const pKey = normalizePronounKey(pronoun);
  const cleanWord = word.trim();

  // Check explicit overrides (e.g. overrides['du'] or overrides['er/sie/es'])
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

  // Check for separable particle (e.g. "stehe auf" -> wordPart: "stehe", particle: "auf")
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

  // Check irregular lookup
  if (IRREGULAR_SPLITS[cleanInf] && IRREGULAR_SPLITS[cleanInf][pKey]) {
    const fixed = IRREGULAR_SPLITS[cleanInf][pKey];
    return { stem: fixed.stem, ending: fixed.ending, particle };
  }

  // Determine candidate endings based on pronoun
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

  // Try matching candidate endings (longest candidate first)
  for (const ending of candidateEndings) {
    if (verbPart.length > ending.length && verbPart.endsWith(ending)) {
      // Guard against cutting too much if stem becomes empty
      const candidateStem = verbPart.slice(0, -ending.length);
      if (candidateStem.length > 0) {
        return {
          stem: candidateStem,
          ending: ending,
          particle
        };
      }
    }
  }

  // Modal verbs / irregular verbs where ich & erSieEs have no ending (e.g. kann, muss, darf, will, soll)
  if ((pKey === 'ich' || pKey === 'erSieEs') && verbPart.length > 0) {
    return { stem: verbPart, ending: '', particle };
  }

  // Fallback: whole word as stem
  return { stem: verbPart, ending: '', particle };
}

/**
 * Validates a user-provided JSON string for German verbs.
 *
 * @param {string} jsonString - The JSON text to parse and validate
 * @param {Array} existingVerbs - Existing verb objects in the platform to check for duplicates
 * @returns {object} Validation result { isValid, items, errors, warnings, syntaxError }
 */
export function validateVerbJson(jsonString = '', existingVerbs = []) {
  if (!jsonString || !jsonString.trim()) {
    return {
      isValid: false,
      isEmpty: true,
      items: [],
      errors: ['JSON input is empty. Paste or write a German verb JSON object.'],
      warnings: [],
      syntaxError: null
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return {
      isValid: false,
      isEmpty: false,
      items: [],
      errors: [`JSON Syntax Error: ${err.message}`],
      warnings: [],
      syntaxError: err.message
    };
  }

  const rawList = Array.isArray(parsed) ? parsed : [parsed];
  if (rawList.length === 0) {
    return {
      isValid: false,
      isEmpty: false,
      items: [],
      errors: ['JSON array contains no items.'],
      warnings: [],
      syntaxError: null
    };
  }

  const errors = [];
  const warnings = [];
  const normalizedItems = [];

  const existingInfinitiveSet = new Set(
    (existingVerbs || []).map(v => (v.infinitive || '').trim().toLowerCase()).filter(Boolean)
  );

  rawList.forEach((raw, idx) => {
    const itemNum = rawList.length > 1 ? ` (Item #${idx + 1})` : '';

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push(`Item #${idx + 1} must be a JSON object { ... }.`);
      return;
    }

    const infinitive = (raw.infinitive || '').trim();
    if (!infinitive) {
      errors.push(`Missing required field "infinitive"${itemNum}.`);
    }

    const translation = (raw.translation || raw.meaning || '').trim();
    if (!translation) {
      errors.push(`Missing required field "translation"${itemNum}.`);
    }

    const conjugation = raw.conjugation;
    if (!conjugation || typeof conjugation !== 'object' || Array.isArray(conjugation)) {
      errors.push(`Missing or invalid "conjugation" object${itemNum}. Expected { "ich": "...", "du": "...", ... }.`);
    }

    // Extract conjugations supporting both camelCase and slash notation
    const conj = conjugation || {};
    const ich = (conj.ich || '').trim();
    const du = (conj.du || '').trim();
    const erSieEs = (conj['er/sie/es'] || conj.erSieEs || conj['er, sie, es'] || '').trim();
    const wir = (conj.wir || '').trim();
    const ihr = (conj.ihr || '').trim();
    const Sie = (conj['sie/Sie'] || conj.Sie || conj['sie/sie'] || conj.sie || '').trim();

    const missingPersons = [];
    if (!ich) missingPersons.push('ich');
    if (!du) missingPersons.push('du');
    if (!erSieEs) missingPersons.push('er/sie/es');
    if (!wir) missingPersons.push('wir');
    if (!ihr) missingPersons.push('ihr');
    if (!Sie) missingPersons.push('sie/Sie');

    if (missingPersons.length > 0) {
      errors.push(`"conjugation"${itemNum} is missing: ${missingPersons.join(', ')}.`);
    }

    // Duplicate check against existing verbs
    if (infinitive && existingInfinitiveSet.has(infinitive.toLowerCase())) {
      warnings.push(`Warning: The verb "${infinitive}" already exists in your platform library.`);
    }

    // Validate optional examples
    let normalizedExamples = [];
    if (Array.isArray(raw.examples)) {
      normalizedExamples = raw.examples
        .filter(ex => ex && (ex.german || ex.english))
        .map(ex => ({
          german: (ex.german || '').trim(),
          english: (ex.english || '').trim()
        }));
    }

    // Normalize type and level
    const verbType = (raw.type || raw.verbType || 'regular').trim().toLowerCase();
    const level = (raw.level || 'A1').trim().toUpperCase();
    const pastParticiple = (raw.pastParticiple || '').trim();
    const auxiliary = (raw.auxiliary || 'haben').trim().toLowerCase();
    const category = (raw.category || 'General').trim();
    const stemEndingOverrides = raw.stemEndingOverrides && typeof raw.stemEndingOverrides === 'object'
      ? raw.stemEndingOverrides
      : null;

    normalizedItems.push({
      infinitive,
      meaning: translation,
      translation,
      type: verbType,
      verbType,
      level,
      ich,
      du,
      erSieEs,
      wir,
      ihr,
      Sie,
      pastParticiple,
      auxiliary,
      examples: normalizedExamples,
      stemEndingOverrides,
      category,
      boxes: Array.isArray(raw.boxes) ? raw.boxes : [],
      favorite: Boolean(raw.favorite),
    });
  });

  return {
    isValid: errors.length === 0,
    isEmpty: false,
    items: normalizedItems,
    errors,
    warnings,
    syntaxError: null
  };
}

/**
 * services/spellChecker.js
 * ─────────────────────────────────────────────────────────────────────────────
 * German orthography (Rechtschreibung) checker built on Google Gemini.
 *
 * Receives a list of entries — each holding one or more GERMAN text fields
 * (words, plurals, verb conjugations, examples, phrases) — and returns the
 * genuine spelling mistakes found, with the corrected text.
 *
 * Only orthography is judged: proper names, loanwords, already-correct words,
 * valid variants and other-language text must never be "corrected".
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL = 'gemini-2.0-flash';
const BATCH_SIZE = 15; // entries per call (each entry can hold several fields)
const TIMEOUT_MS = 60000;

function getModel() {
  if (!process.env.GEMINI_API_KEY) return null;
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model: MODEL });
}

const SYSTEM_PROMPT = `You are a strict, conservative German orthography (Rechtschreibung) checker.
You receive a JSON array of entries. Each entry has:
  "i"  — the entry index
  "f"  — an object whose KEYS are field names and whose VALUES are German texts
         (single words, plural forms, verb conjugations, example sentences, phrases)

Check the spelling of EVERY German text value and correct GENUINE spelling mistakes only.

RULES:
1. Fix only real orthography errors: typos, wrong capitalization of nouns,
   missing or wrong diacritics (ä ö ü ß), wrong verb morphology/endings,
   wrong plural endings, wrong comparative/superlative forms, misspelled
   compound words, doubled or missing letters.
2. NEVER change: proper names and place names, standard loanwords, words that
   are already correct, grammatically different but correctly spelled words,
   values that are not German (translations), and the article of a noun
   ("der Tisch" keeps its article and its space).
3. If a value is spelled correctly, DO NOT include it in the output at all.
4. Correct the spelling only — never translate, rewrite or "improve" style.
5. If you are not sure a form is wrong, treat it as correct.

OUTPUT: strict JSON only — no markdown fences, no commentary:
[{"i":0,"f":[{"k":"<field key exactly as given>","o":"<original text exactly as given>","c":"<corrected text>"}]}]

Return [] when everything is correct.`;

function extractJson(text) {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) throw new Error('No JSON array in model response');
  return JSON.parse(t.slice(start, end + 1));
}

async function checkBatch(model, batch) {
  const payload = batch.map((entry, idx) => ({ i: idx, f: entry.fields }));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let text;
  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{
          text:
            'Check the German spelling of these entries. ' +
            'Answer ONLY with the JSON array, no markdown, no commentary.\n' +
            JSON.stringify(payload),
        }],
      }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      signal: controller.signal,
    });
    text = result.response.text();
  } finally {
    clearTimeout(timer);
  }

  const parsed = extractJson(text);
  const issues = [];
  parsed.forEach(item => {
    const entry = batch[Number(item.i)];
    if (!entry || !Array.isArray(item.f)) return;
    item.f.forEach(f => {
      const key = String(f?.k || '');
      const original = typeof f?.o === 'string' ? f.o : '';
      const corrected = typeof f?.c === 'string' ? f.c.trim() : '';
      if (!key || !(key in entry.fields)) return;
      if (!corrected) return;
      if (corrected === original || corrected === entry.fields[key]) return; // nothing to fix
      issues.push({ ref: entry.ref, type: entry.type, field: key, original: entry.fields[key], corrected });
    });
  });
  return issues;
}

/**
 * entries: [{ ref: recordId, type: recordType, fields: { "<fieldPath>": "<german text>" } }]
 * returns: [{ ref, type, field, original, corrected }]
 */
async function checkGermanSpellings(entries) {
  const model = getModel();
  if (!model) {
    const err = new Error('Spelling service requires the GEMINI_API_KEY environment variable');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const issues = [];
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    try {
      const batchIssues = await checkBatch(model, batch);
      issues.push(...batchIssues);
    } catch (e) {
      console.warn(`[SpellChecker] batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, e.message);
    }
  }
  return issues;
}

// ── Record field helpers ─────────────────────────────────────────────────────

// Collect the GERMAN text fields worth spell-checking for one record.
// Keys are field paths: flat keys for flat records, dotted paths for the
// nested unified-vocab shapes (e.g. "noun.pluralForm", "verb.conjugation.ich").
function spellFieldsOf(r) {
  const fields = {};
  const put = (k, v) => { if (typeof v === 'string' && v.trim()) fields[k] = v; };
  if (r.type === 'vocab') {
    put('word', r.word); put('plural', r.plural); put('example', r.example);
  } else if (r.type === 'unified-vocab') {
    put('word', r.word); put('example', r.example);
    put('noun.pluralForm', r.noun?.pluralForm);
    put('adjective.comparative', r.adjective?.comparative);
    put('adjective.superlative', r.adjective?.superlative);
    Object.entries(r.verb?.conjugation || {}).forEach(([k, v]) => put(`verb.conjugation.${k}`, v));
  } else if (r.type === 'verb') {
    ['infinitive', 'ich', 'du', 'erSieEs', 'wir', 'ihr', 'Sie', 'pastParticiple']
      .forEach(k => put(k, r[k]));
  } else if (r.type === 'expression' || r.type === 'idiom') {
    put('phrase', r.phrase);
  }
  return fields;
}

// Turn a record's spell issues into an update payload. Nested paths are
// merged into the EXISTING sub-objects so unrelated fields (gender, other
// conjugations…) survive the update.
function spellUpdatesOf(rec, list) {
  const updates = {};
  const group = (key) => (updates[key] = updates[key] ? updates[key] : { ...(rec[key] || {}) });
  list.forEach(({ field, corrected }) => {
    const parts = field.split('.');
    if (parts.length === 1) updates[field] = corrected;
    else if (parts[0] === 'verb' && parts[1] === 'conjugation') {
      const verb = group('verb');
      verb.conjugation = { ...(verb.conjugation || {}), [parts[2]]: corrected };
    } else {
      group(parts[0])[parts[1]] = corrected;
    }
  });
  return updates;
}

module.exports = { checkGermanSpellings, spellFieldsOf, spellUpdatesOf, MODEL };

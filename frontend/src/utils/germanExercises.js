/**
 * germanExercises.js — Knowledge-test engine for the German Learning section.
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure JavaScript (no React, no DOM) so the SAME generator is used by:
 *   • the interactive "Exercises" tab (GermanExercises.jsx)
 *   • the PDF report (germanPdfBuilder.js + components/GermanReport.jsx)
 *
 * Exercise types — every part of the course is covered:
 *   article     → guess the Artikel (der / die / das) of a noun from the vocab list
 *   picture     → see the vocabulary PHOTO, then write the Artikel, the word,
 *                 its feminine form and the plural (multi-part question)
 *   conjugation → choose the most suitable verb of the chapter for a sentence,
 *                 then write its Präsens form for a given pronoun (multi-part)
 *   gender      → choose the feminine form of a masculine noun (der Student → die Studentin)
 *   plural      → write down the plural of the given word
 *   possessive  → solve fill-in exercises about possessive articles (mein/dein/sein…)
 *   numbers     → numbers in German (write / recognize 0–999)
 *   translation → word-by-word translation DE ⇄ EN of the vocabulary
 *   cases       → Akkusativ / Dativ / Genitiv article forms + case pronouns
 *   comparison  → Komparativ & Superlativ of the course's adjectives
 *   example     → fill the gap inside the vocabulary's own example sentence
 *   verbForm    → write the Präsens form of a given verb + pronoun (all verb tables)
 *   grammar     → match the 65 grammar rules with their examples / fill their gaps
 *   expression  → the Redemittel of every level (phrase ⇄ translation)
 *   idiom       → idioms: phrase ⇄ meaning ⇄ translation
 *   mistake     → correct the typical mistakes of the course
 *   dialogue    → pick the right reply / speaker of the course's dialogues
 *   alphabet    → letters, pronunciation, example words & the umlauts ä ö ü ß
 *   mixed       → a bit of everything
 *
 * Scoping: every generator loops the records it is given. When a chapterId is
 * supplied only that chapter's records are used, otherwise the WHOLE database
 * is looped ("All chapters" mode).
 */

const ARTICLES = ['der', 'die', 'das'];

// ── Deterministic RNG (seeded) so the PDF worksheets stay stable ────────────
function hashString(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  let seed = a >>> 0;
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  if (seed == null || seed === '') return mulberry32(Math.floor(Math.random() * 1e9));
  return mulberry32(typeof seed === 'number' ? seed : hashString(String(seed)));
}

function shuffleWithSeed(list, rng) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

// ── Article / word helpers ──────────────────────────────────────────────────
const ARTICLE_PREFIX = /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer)\s+/i;

function stripArticle(text) {
  return String(text || '').trim().replace(ARTICLE_PREFIX, '').trim();
}

function normalizeArticle(article) {
  if (!article) return '';
  const first = String(article).trim().toLowerCase().split(/[\s/|,]+/)[0];
  return ARTICLES.includes(first) ? first : '';
}

function genderToArticle(gender) {
  const g = String(gender || '').toLowerCase();
  if (g.startsWith('mask') || g.startsWith('männ') || g.startsWith('male')) return 'der';
  if (g.startsWith('fem') || g.startsWith('weib') || g.startsWith('female')) return 'die';
  if (g.startsWith('neut') || g.startsWith('neutral')) return 'das';
  return '';
}

const capitalize = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w);

/**
 * Normalize any vocabulary record (`vocab` or `unified-vocab`) into the flat
 * shape the exercise builders consume.
 */
export function normalizeVocabRecord(r) {
  if (!r) return null;
  if (r.type === 'vocab') {
    const rawWord = String(r.word || '').trim();
    const detected = rawWord.match(ARTICLE_PREFIX);
    const article = normalizeArticle(r.article) || (detected ? detected[1].toLowerCase() : '');
    const word = stripArticle(rawWord);
    if (!word) return null;
    return {
      recordId: r.recordId,
      word,
      article,
      plural: stripArticle(r.plural),
      translation: String(r.translation || ''),
      example: String(r.example || ''),
      photoUrl: String(r.photoUrl || ''),
      wordType: r.wordType || 'noun',
      comparative: String(r.comparative || ''),
      superlative: String(r.superlative || ''),
      chapterId: r.chapterId || null,
      chapterTitle: r.chapterTitle || '',
    };
  }
  if (r.type === 'unified-vocab') {
    const noun = r.noun || {};
    const word = stripArticle(r.word);
    if (!word) return null;
    const article = normalizeArticle(noun.article) || genderToArticle(noun.gender);
    const pos = String(r.partOfSpeech || '').toLowerCase();
    const wordType = pos.includes('verb') ? 'verb'
      : pos.includes('adj') ? 'adjective'
        : (article || stripArticle(noun.pluralForm || noun.plural)) ? 'noun' : 'other';
    return {
      recordId: r.recordId,
      word,
      article,
      plural: stripArticle(noun.pluralForm || noun.plural || ''),
      translation: String(r.translation || ''),
      example: String(r.example || ''),
      photoUrl: String(r.photoUrl || ''),
      wordType,
      comparative: String((r.adjective && r.adjective.comparative) || ''),
      superlative: String((r.adjective && r.adjective.superlative) || ''),
      chapterId: r.chapterId || null,
      chapterTitle: r.chapterTitle || '',
    };
  }
  return null;
}

export function normalizeVocab(records) {
  return (Array.isArray(records) ? records : []).map(normalizeVocabRecord).filter(Boolean);
}

/**
 * Loop the vocabulary. With a chapterId only that chapter's words are used,
 * otherwise every vocabulary record of the database is looped.
 */
export function scopeVocab(records, chapterId) {
  const all = normalizeVocab(records);
  if (!chapterId) return all;
  return all.filter((v) => v.chapterId === chapterId);
}

// ── Numbers in German (0–999) ───────────────────────────────────────────────
const ONES = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun',
  'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

export function numberToGerman(n) {
  const num = Math.floor(Number(n));
  if (!Number.isFinite(num) || num < 0 || num > 999) return '';
  if (num < 20) return ONES[num];
  if (num < 100) {
    const ones = num % 10;
    const tens = Math.floor(num / 10);
    if (!ones) return TENS[tens];
    return `${ones === 1 ? 'ein' : ONES[ones]}und${TENS[tens]}`;
  }
  const hundreds = Math.floor(num / 100);
  const rest = num % 100;
  const head = `${hundreds === 1 ? 'ein' : ONES[hundreds]}hundert`;
  return rest ? head + numberToGerman(rest) : head;
}

// ── Masculine → Feminine derivation ─────────────────────────────────────────
// Irregular pairs that no suffix rule can produce.
const FEMININE_IRREGULAR = {
  mann: 'frau', vater: 'mutter', bruder: 'schwester', sohn: 'tochter',
  onkel: 'tante', herr: 'frau', neffe: 'nichte', junge: 'mädchen',
  opa: 'oma', graf: 'gräfin', gatte: 'gattin',
};

// Suffixes that reliably build a female agent noun with -in.
const FEMININE_SUFFIXES = ['and', 'ant', 'ent', 'at', 'or', 'nom', 'oge', 'graf', 'held', 'hirt', 'meister', 'er'];

// English translations that tell us an -er/-or noun is a person
// (Lehrer → "teacher" ✓, but Computer / Motor / Hammer are NOT people).
const PERSON_TRANSLATION_RE = /\b(man|men|person|male|boy|guy|gentleman)\b|teacher|student|doctor|driver|farmer|baker|butcher|singer|writer|reader|soldier|judge|lawyer|waiter|cook|pilot|engineer|manager|colleague|neighbor|neighbour|friend|worker|guard|hunter|fisher|owner|client|guest|host|king|prince|monk|priest|father|dad|uncle|brother|husband|helper|player|runner|speaker|visitor|author|actor|poet|lord|head|chief|candidate|apprentice/i;

/**
 * Derive the feminine form of a masculine noun.
 * Returns the capitalized feminine noun, or null when the derivation is not
 * safe (in which case the word is simply skipped by the gender exercise).
 */
export function deriveFeminine(article, word, translation) {
  if (article !== 'der') return null;
  const w = String(word || '').trim();
  if (!w || w.length < 3) return null;
  const lower = w.toLowerCase();
  if (FEMININE_IRREGULAR[lower]) return capitalize(FEMININE_IRREGULAR[lower]);
  if (lower.endsWith('mann')) return w.slice(0, -4) + 'frau';
  // -e nouns: Kollege → Kollegin, Zeuge → Zeugin, Gatte → Gattin
  if (/[^aeiouäöü]e$/i.test(w)) return w.slice(0, -1) + 'in';
  for (const suffix of FEMININE_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      if ((suffix === 'er' || suffix === 'or') && !PERSON_TRANSLATION_RE.test(translation || '')) continue;
      return w + 'in';
    }
  }
  // der Freund → die Freundin (only when the translation confirms a person)
  if (lower.endsWith('d') && /friend/i.test(translation || '')) return w + 'in';
  return null;
}

// ── Possessive articles ─────────────────────────────────────────────────────
const POSSESSIVE_PRONOUNS = [
  { stem: 'mein', who: 'ich', hint: '(mein)' },
  { stem: 'dein', who: 'du', hint: '(dein)' },
  { stem: 'sein', who: 'er/sie/es', hint: '(sein)' },
  { stem: 'ihr', who: 'sie (she)', hint: '(ihr)' },
  { stem: 'unser', who: 'wir', hint: '(unser)' },
  { stem: 'euer', who: 'ihr', hint: '(euer)' },
  { stem: 'ihr', who: 'sie (they)', hint: '(ihr)' },
  { stem: 'Ihr', who: 'Sie (formal)', hint: '(Ihr)' },
];

const POSSESSIVE_TEMPLATES = {
  nom: [(n) => `Das ist ___ ${n}.`, (n) => `___ ${n} ist sehr wichtig.`],
  akk: [(n) => `Ich sehe ___ ${n}.`, (n) => `Wir brauchen ___ ${n} heute.`],
  dat: [(n) => `Ich helfe ___ ${n}.`, (n) => `Das gehört ___ ${n}.`, (n) => `Das Buch fehlt ___ ${n}.`],
};

export function possessiveEnding(article, caseKey, isPlural) {
  if (isPlural) return 'en'; // meine / meine / meinen Kinder
  if (article === 'der') return caseKey === 'nom' ? 'er' : caseKey === 'akk' ? 'en' : 'em';
  if (article === 'die') return caseKey === 'dat' ? 'er' : 'e';
  return caseKey === 'dat' ? 'em' : ''; // das
}

export function possessiveForm(stem, article, caseKey, isPlural) {
  return `${stem}${possessiveEnding(article, caseKey, isPlural)}`;
}

// ── Question builders ───────────────────────────────────────────────────────
function pickOptions(correct, distractors, rng) {
  const seen = new Set([String(correct)]);
  const opts = [String(correct)];
  for (const d of shuffleWithSeed(distractors, rng)) {
    const val = String(d);
    if (!val || seen.has(val)) continue;
    seen.add(val);
    opts.push(val);
    if (opts.length === 4) break;
  }
  return shuffleWithSeed(opts, rng);
}

function buildArticleQuestions(vocab, rng, count) {
  const pool = vocab.filter((v) => v.article && v.wordType !== 'verb' && v.wordType !== 'adjective');
  return shuffleWithSeed(pool, rng).slice(0, count).map((v) => ({
    type: 'article',
    kind: 'choice',
    prompt: 'What is the Artikel (der / die / das) of this noun?',
    question: v.word,
    options: pickOptions(v.article, ARTICLES.filter((a) => a !== v.article).concat(ARTICLES), rng),
    answer: v.article,
    translation: v.translation,
  }));
}

function buildGenderQuestions(vocab, rng, count) {
  const derived = [];
  for (const v of vocab) {
    if (v.article !== 'der') continue;
    const feminine = deriveFeminine(v.article, v.word, v.translation);
    if (feminine) derived.push({ v, feminine });
  }
  const femininePool = derived.map((d) => d.feminine);
  return shuffleWithSeed(derived, rng).slice(0, count).map(({ v, feminine }) => ({
    type: 'gender',
    kind: 'choice',
    prompt: 'Choose the FEMININE form of this masculine noun:',
    question: `der ${v.word}`,
    options: pickOptions(feminine, shuffleWithSeed(femininePool, rng).concat([`${v.word}e`, `${v.word}n`, v.word]), rng),
    answer: feminine,
    translation: v.translation,
  }));
}

const PLURAL_PLACEHOLDERS = new Set(['', '-', '—', '–', 'kein plural', 'keine', 'no plural', 'plural', 'unregelmäßig']);

/** A word only counts as "plural exercise ready" with a real, distinct plural. */
function hasUsablePlural(v) {
  const plural = String(v.plural || '').trim();
  return !!plural && !PLURAL_PLACEHOLDERS.has(plural.toLowerCase()) && plural.toLowerCase() !== v.word.toLowerCase();
}

function buildPluralQuestions(vocab, rng, count) {
  const pool = vocab.filter((v) => hasUsablePlural(v) && v.wordType !== 'adjective');
  return shuffleWithSeed(pool, rng).slice(0, count).map((v) => ({
    type: 'plural',
    kind: 'text',
    prompt: 'Write down the PLURAL of this word:',
    question: `${v.article ? v.article + ' ' : ''}${v.word}`,
    options: null,
    answer: v.plural,
    translation: v.translation,
  }));
}

/**
 * Picture round — the word stays hidden behind its photo. The learner sees the
 * image and has to write down:
 *   1 · the Artikel (der / die / das)   2 · the vocabulary word itself
 *   3 · the feminine form (when derivable)   4 · the plural (when known)
 * Every question therefore carries a `parts` array; each part is scored on its
 * own (see checkAnswer / buildExerciseResultPayload).
 */
function buildPictureQuestions(vocab, rng, count) {
  const pool = vocab.filter((v) => v.photoUrl && v.article && v.wordType !== 'verb' && v.wordType !== 'adjective');
  return shuffleWithSeed(pool, rng).slice(0, count).map((v) => {
    const parts = [
      { key: 'article', label: 'Artikel', kind: 'choice', options: ARTICLES, answer: v.article, placeholder: 'der / die / das' },
      { key: 'word', label: 'The word', kind: 'text', answer: v.word, placeholder: 'Write the noun you see…' },
    ];
    const feminine = deriveFeminine(v.article, v.word, v.translation);
    if (feminine) parts.push({ key: 'feminine', label: 'Feminine form', kind: 'text', answer: feminine, placeholder: 'die …in' });
    if (hasUsablePlural(v)) parts.push({ key: 'plural', label: 'Plural', kind: 'text', answer: v.plural, placeholder: 'die …e / die …' });
    return {
      type: 'picture',
      kind: 'multi',
      prompt: 'Look at the picture — write the Artikel, the word, its feminine form and the plural:',
      question: v.translation ? `Picture (${v.translation})` : 'Picture',
      photoUrl: v.photoUrl,
      parts,
      options: null,
      answer: `${v.article} ${v.word}`,
      translation: v.translation,
    };
  });
}

// ── Verbs — choose the right verb & conjugate it (Präsens) ───────────────────
const VERB_PERSONS = [
  { key: 'ich', label: 'ich' },
  { key: 'du', label: 'du' },
  { key: 'erSieEs', label: 'er/sie/es' },
  { key: 'wir', label: 'wir' },
  { key: 'ihr', label: 'ihr' },
  { key: 'Sie', label: 'sie / Sie' },
];

/** Map any conjugation-map key ('er/sie/es', 'er_sie_es', 'sie/Sie'…) to our keys. */
function verbPronounKey(key) {
  const k = String(key || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (k === 'ersiees') return 'erSieEs';
  if (k === 'sie' || k === 'siesie') return 'Sie'; // 'sie' | 'sie/Sie' | 'sie/sie'
  if (k === 'ich' || k === 'du' || k === 'wir' || k === 'ihr') return k;
  return '';
}

/**
 * Normalize a verb record into the flat shape the conjugation builder consumes.
 * Supports:
 *   • type 'verb'          → flat { infinitive, meaning, ich, du, erSieEs, … }
 *   • type 'unified-vocab' with partOfSpeech "verb" → { word, verb: { conjugation } }
 */
export function normalizeVerbRecord(r) {
  if (!r) return null;
  if (r.type === 'verb') {
    const infinitive = String(r.infinitive || '').trim();
    if (!infinitive) return null;
    const forms = {};
    VERB_PERSONS.forEach((p) => { forms[p.key] = String(r[p.key] || '').trim(); });
    return {
      recordId: r.recordId,
      infinitive,
      meaning: String(r.meaning || ''),
      forms,
      examples: Array.isArray(r.examples) ? r.examples : [],
      category: String(r.category || ''),
      verbType: String(r.verbType || ''),
      pastParticiple: String(r.pastParticiple || ''),
      auxiliary: String(r.auxiliary || ''),
      chapterId: r.chapterId || null,
      chapterTitle: r.chapterTitle || '',
    };
  }
  if (r.type === 'unified-vocab') {
    const pos = String(r.partOfSpeech || '').toLowerCase();
    if (!pos.includes('verb')) return null;
    const infinitive = stripArticle(r.word);
    if (!infinitive) return null;
    const verb = r.verb || {};
    const conj = verb.conjugation || {};
    const forms = {};
    Object.keys(conj || {}).forEach((k) => {
      const key = verbPronounKey(k);
      const form = String(conj[k] || '').trim();
      if (key && form && !forms[key]) forms[key] = form;
    });
    return {
      recordId: r.recordId,
      infinitive,
      meaning: String(r.translation || ''),
      forms,
      examples: r.example ? [{ german: r.example, english: r.exampleTranslation || '' }] : [],
      category: '',
      verbType: String(verb.type || ''),
      pastParticiple: String(verb.pastParticiple || ''),
      auxiliary: String(verb.auxiliary || ''),
      chapterId: r.chapterId || null,
      chapterTitle: r.chapterTitle || '',
    };
  }
  return null;
}

/** Loop the verb records of the given scope (one chapter, or the whole DB). */
export function scopeVerbs(records, chapterId) {
  const all = (Array.isArray(records) ? records : []).map(normalizeVerbRecord).filter(Boolean);
  if (!chapterId) return all;
  return all.filter((v) => v.chapterId === chapterId);
}

/** The filled Präsens forms of a verb: [{ pronoun, label, form }] */
function verbForms(v) {
  const forms = (v && v.forms) || {};
  return VERB_PERSONS
    .map((p) => ({ pronoun: p.key, label: p.label, form: String(forms[p.key] || '').trim() }))
    .filter((f) => f.form);
}

const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replace the conjugated verb form in an example sentence by a gap (___).
 * Tries every Präsens form so separable verbs ("stehe auf") and unusual
 * word orders are covered; returns '' when no form occurs in the sentence.
 */
function blankVerbInSentence(sentence, forms) {
  const text = String(sentence || '');
  for (const form of forms) {
    const token = String(form).trim();
    if (!token) continue;
    const re = new RegExp(`(^|[^\\p{L}])${escapeRegExp(token)}(?![\\p{L}])`, 'iu');
    if (re.test(text)) return text.replace(re, '$1___');
  }
  return '';
}

/** The best clue sentence for a verb: the first example that contains a form. */
function blankedSentenceFor(v) {
  const forms = verbForms(v).map((f) => f.form);
  if (!forms.length) return '';
  for (const ex of (Array.isArray(v.examples) ? v.examples : [])) {
    const german = String((ex && ex.german) || (typeof ex === 'string' ? ex : '') || '').trim();
    if (!german) continue;
    const blanked = blankVerbInSentence(german, forms);
    if (blanked) return blanked;
  }
  return '';
}

/**
 * Verbs that can fuel a conjugation question: deduplicated by infinitive,
 * at least 3 filled Präsens forms, and a clue to guess it (example sentence
 * or translation). Chapter scope is applied upstream (scopeVerbs).
 */
export function scopeConjugationVerbs(records, chapterId) {
  const seen = new Set();
  const out = [];
  for (const v of scopeVerbs(records, chapterId)) {
    const key = v.infinitive.toLowerCase();
    if (seen.has(key)) continue;
    if (verbForms(v).length < 3) continue;
    if (!v.meaning && !blankedSentenceFor(v)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/**
 * Conjugation round — two steps per question:
 *   1 · CHOOSE the most suitable verb (options are the verbs of this chapter)
 *   2 · CONJUGATE it in the Präsens for a random pronoun
 * The clue is the verb's own example sentence with the form blanked out, or
 * its meaning when no usable sentence exists.
 */
function buildConjugationQuestions(verbs, rng, count) {
  const infinitives = verbs.map((v) => v.infinitive);
  return shuffleWithSeed(verbs, rng).slice(0, count).map((v) => {
    const forms = verbForms(v);
    const target = forms[Math.floor(rng() * forms.length)];
    const sentence = blankedSentenceFor(v);
    const distractors = infinitives.filter((i) => i.toLowerCase() !== v.infinitive.toLowerCase());
    const parts = [
      {
        key: 'verb',
        label: 'The most suitable verb',
        kind: 'choice',
        options: pickOptions(v.infinitive, distractors, rng),
        answer: v.infinitive,
      },
      {
        key: 'conjugated',
        label: `Conjugate for ${target.label}`,
        kind: 'text',
        answer: target.form,
        // separable verbs are stored as "stehe auf" — also accept the bare part
        alternates: target.form.includes(' ') ? [target.form.split(' ')[0]] : undefined,
        placeholder: 'Write the Präsens form…',
      },
    ];
    return {
      type: 'conjugation',
      kind: 'multi',
      prompt: sentence
        ? 'Choose the most suitable verb for this sentence, then conjugate it in the Präsens:'
        : 'Choose the most suitable verb (see its meaning), then conjugate it in the Präsens:',
      question: sentence || v.meaning,
      parts,
      options: null,
      answer: `${v.infinitive} → ${target.form}`,
      translation: v.meaning,
    };
  });
}

function buildPossessiveQuestions(vocab, rng, count) {
  const nouns = vocab.filter((v) => v.article && v.wordType !== 'verb' && v.wordType !== 'adjective');
  if (!nouns.length) return [];
  const questions = [];
  const cases = ['nom', 'akk', 'dat'];
  const total = Math.min(count, Math.max(nouns.length, 1));
  const picked = shuffleWithSeed(nouns, rng);
  for (let i = questions.length; i < total && i < picked.length + total; i++) {
    const v = picked[i % picked.length];
    const isPlural = i >= picked.length; // second pass practises the plural endings
    const pluralWord = isPlural ? v.plural : '';
    if (isPlural && (!pluralWord || PLURAL_PLACEHOLDERS.has(pluralWord.toLowerCase()))) continue;
    const pronoun = POSSESSIVE_PRONOUNS[Math.floor(rng() * POSSESSIVE_PRONOUNS.length)];
    const caseKey = isPlural ? (rng() < 0.5 ? 'nom' : 'akk') : cases[Math.floor(rng() * cases.length)];
    const wordForSentence = isPlural ? pluralWord : v.word;
    const templates = POSSESSIVE_TEMPLATES[caseKey];
    const sentence = templates[Math.floor(rng() * templates.length)](wordForSentence);
    const answer = possessiveForm(pronoun.stem, v.article, caseKey, isPlural);
    const endings = ['er', 'e', 'en', 'em', ''];
    const distractors = endings
      .map((e) => `${pronoun.stem}${e}`)
      .filter((form) => form !== answer);
    questions.push({
      type: 'possessive',
      kind: 'choice',
      prompt: `Choose the correct possessive article — ${pronoun.who} ${pronoun.hint}:`,
      question: sentence,
      options: pickOptions(answer, distractors, rng),
      answer,
      translation: v.translation,
    });
    if (questions.length >= count) break;
  }
  return questions;
}

function buildNumberQuestions(rng, count) {
  const questions = [];
  let last = -1;
  for (let i = 0; i < count; i++) {
    let num = Math.floor(rng() * 99) + 1;
    if (i % 5 === 4) num = Math.floor(rng() * 899) + 100; // some bigger numbers
    if (num === last) num = Math.min(999, num + 1 + Math.floor(rng() * 5));
    last = num;
    const german = numberToGerman(num);
    if (!german) continue;
    if (i % 2 === 0) {
      // write the number in German
      questions.push({
        type: 'numbers',
        kind: 'text',
        prompt: 'Write this number in German:',
        question: String(num),
        options: null,
        answer: german,
        translation: '',
      });
    } else {
      // recognize the German number
      const distractors = [num + 1, Math.max(1, num - 1), num + 10, Math.max(1, num - 10), num + 2]
        .filter((n) => n !== num && n <= 999 && n > 0);
      questions.push({
        type: 'numbers',
        kind: 'choice',
        prompt: 'Which number is this in German?',
        question: german,
        options: pickOptions(String(num), shuffleWithSeed(distractors, rng).map(String), rng),
        answer: String(num),
        translation: '',
      });
    }
  }
  return questions;
}

// ── Course-content pools (grammar, expressions, idioms, mistakes, …) ────────
/** Filter raw records by their `type` field and — when given — by chapter. */
function scopeRecords(records, chapterId, types) {
  const list = (Array.isArray(records) ? records : []).filter((r) => r && Array.isArray(types) && types.includes(r.type));
  if (!chapterId) return list;
  return list.filter((r) => (r.chapterId || null) === chapterId);
}

function normalizeGrammarRecord(r) {
  if (!r) return null;
  const rule = String(r.rule || '').trim();
  if (!rule) return null;
  const examples = (Array.isArray(r.examples) ? r.examples : [])
    .map((s) => String(s || '').trim()).filter(Boolean);
  return {
    recordId: r.recordId,
    rule,
    explanation: String(r.explanation || '').trim(),
    examples,
    category: String(r.category || ''),
    chapterId: r.chapterId || null,
  };
}

function normalizeExpressionRecord(r) {
  if (!r) return null;
  const phrase = String(r.phrase || '').trim();
  const translation = String(r.translation || '').trim();
  if (!phrase || !translation) return null;
  return { recordId: r.recordId, phrase, translation, category: String(r.category || ''), chapterId: r.chapterId || null };
}

function normalizeIdiomRecord(r) {
  if (!r) return null;
  const phrase = String(r.phrase || '').trim();
  const translation = String(r.translation || '').trim();
  const meaning = String(r.meaning || '').trim();
  if (!phrase || (!translation && !meaning)) return null;
  return {
    recordId: r.recordId, phrase, translation, meaning,
    usage: String(r.usage || '').trim(), chapterId: r.chapterId || null,
  };
}

function normalizeMistakeRecord(r) {
  if (!r) return null;
  const incorrect = String(r.incorrect || '').trim();
  const correct = String(r.correct || '').trim();
  if (!incorrect || !correct || incorrect === correct) return null;
  return {
    recordId: r.recordId, incorrect, correct,
    why: String(r.why || '').trim(), chapterId: r.chapterId || null,
  };
}

function normalizeDialogueRecord(r) {
  if (!r) return null;
  const participants = (Array.isArray(r.participants) ? r.participants : [])
    .map((p) => String((p && p.name) || '').trim()).filter(Boolean);
  // Dialogues store their lines as `german` (+ `original` translation);
  // `text` is accepted too so older/hand-made records keep working.
  const exchanges = (Array.isArray(r.exchanges) ? r.exchanges : [])
    .map((e) => ({
      speakerIndex: Math.max(0, Number(e && e.speakerIndex) || 0),
      text: String((e && (e.german || e.text)) || '').trim(),
      translation: String((e && (e.original || e.translation)) || '').trim(),
    }))
    .filter((e) => e.text);
  if (!exchanges.length) return null;
  return {
    recordId: r.recordId,
    title: String(r.title || '').trim(),
    participants,
    exchanges,
    chapterId: r.chapterId || null,
  };
}

function normalizeAlphabetRecord(r) {
  if (!r) return null;
  const letter = String(r.letter || '').trim();
  if (!letter) return null;
  return {
    recordId: r.recordId,
    letter,
    example: String(r.example || '').trim(),
    english: String(r.english || '').trim(),
    pronunciation: String(r.pronunciation || '').trim(),
    chapterId: r.chapterId || null,
  };
}

function poolGrammar(records, chapterId) {
  return scopeRecords(records, chapterId, ['grammar']).map(normalizeGrammarRecord).filter(Boolean);
}
function poolExpressions(records, chapterId) {
  return scopeRecords(records, chapterId, ['expression']).map(normalizeExpressionRecord).filter(Boolean);
}
function poolIdioms(records, chapterId) {
  return scopeRecords(records, chapterId, ['idiom']).map(normalizeIdiomRecord).filter(Boolean);
}
function poolMistakes(records, chapterId) {
  return scopeRecords(records, chapterId, ['mistake']).map(normalizeMistakeRecord).filter(Boolean);
}
function poolDialogues(records, chapterId) {
  return scopeRecords(records, chapterId, ['dialogue']).map(normalizeDialogueRecord).filter(Boolean);
}
/** The alphabet lives on level A1.1 without a chapter → only in "All chapters". */
function poolAlphabet(records, chapterId) {
  if (chapterId) return [];
  return scopeRecords(records, null, ['alphabet']).map(normalizeAlphabetRecord).filter(Boolean);
}

/** The umlauts / ß of the "Alphabets" tab — taught next to the 26 letters. */
const SPECIAL_CHARS = [
  { letter: 'ä', example: 'Mädchen', english: 'girl', pronunciation: 'metshen' },
  { letter: 'ö', example: 'schön', english: 'beautiful', pronunciation: 'shern' },
  { letter: 'ü', example: 'über', english: 'over', pronunciation: 'oo-ber' },
  { letter: 'ß', example: 'Straße', english: 'street', pronunciation: 'shtrah-se' },
  { letter: 'Ä', example: 'Ärger', english: 'anger', pronunciation: 'air-ger' },
  { letter: 'Ö', example: 'Öl', english: 'oil', pronunciation: 'uhl' },
  { letter: 'Ü', example: 'Übung', english: 'exercise', pronunciation: 'oo-boong' },
];

/** "the family" and "family" must both count as a correct English answer. */
function stripEnglishArticle(text) {
  const s = String(text || '').trim();
  const m = s.match(/^(the|a|an)\s+/i);
  return m ? s.slice(m[0].length) : '';
}

const hasChoiceOptions = (opts) => Array.isArray(opts) && new Set(opts.map(String)).size >= 2;

// ── Grammar rules — match rule ↔ example, fill the gap of an example ───────
const CLOZE_STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einem', 'einen', 'kein', 'keine', 'keinen',
  'und', 'oder', 'aber', 'sondern', 'denn', 'doch', 'auch', 'nur', 'noch', 'schon', 'dann', 'wie', 'wo',
  'was', 'wer', 'wann', 'woher', 'wohin', 'warum', 'wenn', 'weil', 'dass', 'ob', 'als', 'sehr', 'mehr',
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'sich', 'man', 'mir', 'dir', 'mich', 'dich', 'uns', 'euch',
  'mit', 'von', 'zu', 'in', 'an', 'auf', 'für', 'aus', 'nach', 'bei', 'vor', 'ohne', 'um', 'über', 'unter',
  'im', 'am', 'zum', 'zur', 'beim', 'ins', 'ans', 'vom', 'beim', 'nicht', 'ja', 'nein', 'kann', 'muss', 'soll',
  'will', 'darf', 'mag', 'sein', 'haben', 'werden', 'worden', 'hat', 'habe', 'hast', 'hatte', 'war', 'sind',
  'bin', 'bist', 'ist', 'seid', 'wird', 'sollte', 'würde', 'hätte', 'hätten', 'konnte',
]);

function pickClozeWord(sentence, hint) {
  const tokens = String(sentence || '').split(/[^A-Za-zÄÖÜäöüß]+/).filter(Boolean);
  const hintLow = String(hint || '').toLowerCase();
  const content = tokens.filter((t) => t.length >= 3 && !CLOZE_STOPWORDS.has(t.toLowerCase()));
  if (!content.length) return '';
  const inHint = content.filter((t) => hintLow.includes(t.toLowerCase()));
  const from = inHint.length ? inHint : content;
  return from.reduce((best, t) => (t.length > best.length ? t : best), '');
}

function blankToken(sentence, token) {
  const text = String(sentence || '');
  const re = new RegExp(`(^|[^\\p{L}])${escapeRegExp(token)}(?![\\p{L}])`, 'iu');
  if (!re.test(text)) return '';
  return text.replace(re, '$1___');
}

function buildGrammarQuestions(rules, rng, count) {
  const candidates = [];
  const ruleNames = rules.map((r) => r.rule).filter(Boolean);
  const allExamples = rules.flatMap((r) => r.examples);
  for (const r of rules) {
    for (const ex of r.examples) {
      if (hasChoiceOptions(ruleNames)) {
        candidates.push({
          type: 'grammar', kind: 'choice',
          prompt: 'Which grammar rule does this example illustrate?',
          question: ex,
          options: pickOptions(r.rule, ruleNames.filter((n) => n !== r.rule), rng),
          answer: r.rule,
          translation: r.explanation,
        });
      }
      const token = pickClozeWord(ex, `${r.rule} ${r.explanation} ${r.category}`);
      const blanked = token ? blankToken(ex, token) : '';
      if (blanked) {
        candidates.push({
          type: 'grammar', kind: 'text',
          prompt: `Fill the gap — grammar rule "${r.rule}":`,
          question: blanked,
          options: null,
          answer: token,
          translation: r.explanation,
        });
      }
      const others = allExamples.filter((e) => e !== ex);
      if (hasChoiceOptions(others.concat(ex))) {
        candidates.push({
          type: 'grammar', kind: 'choice',
          prompt: `Choose the correct example for the rule "${r.rule}":`,
          question: r.rule,
          options: pickOptions(ex, others, rng),
          answer: ex,
          translation: r.explanation,
        });
      }
    }
    if (!r.examples.length && r.explanation && hasChoiceOptions(ruleNames)) {
      candidates.push({
        type: 'grammar', kind: 'choice',
        prompt: 'Which grammar rule is described here?',
        question: r.explanation,
        options: pickOptions(r.rule, ruleNames.filter((n) => n !== r.rule), rng),
        answer: r.rule,
        translation: r.category,
      });
    }
  }
  return shuffleWithSeed(candidates, rng).slice(0, count);
}

// ── Translations — the vocabulary word ⇄ its English meaning ───────────────
function buildTranslationQuestions(vocab, rng, count) {
  const usable = vocab.filter((v) => v.word && v.translation);
  const translations = usable.map((v) => v.translation);
  const words = usable.map((v) => (v.article ? `${v.article} ${v.word}` : v.word));
  const candidates = [];
  for (const v of usable) {
    const full = v.article ? `${v.article} ${v.word}` : v.word;
    const enAlts = [stripEnglishArticle(v.translation)].filter(Boolean);
    candidates.push({
      type: 'translation', kind: 'text',
      prompt: 'Translate this German word into ENGLISH:',
      question: full, options: null,
      answer: v.translation, alternates: enAlts, translation: v.translation,
    });
    candidates.push({
      type: 'translation', kind: 'text',
      prompt: 'Write this English word in GERMAN:',
      question: v.translation, options: null,
      answer: full, alternates: [v.word], translation: v.translation,
    });
    if (hasChoiceOptions(translations)) {
      candidates.push({
        type: 'translation', kind: 'choice',
        prompt: 'Choose the correct ENGLISH translation:',
        question: full,
        options: pickOptions(v.translation, translations.filter((t) => t !== v.translation), rng),
        answer: v.translation,
        translation: v.translation,
      });
    }
    if (hasChoiceOptions(words)) {
      candidates.push({
        type: 'translation', kind: 'choice',
        prompt: 'Choose the correct GERMAN word:',
        question: v.translation,
        options: pickOptions(full, words.filter((w) => w !== full), rng),
        answer: full,
        translation: v.translation,
      });
    }
  }
  return shuffleWithSeed(candidates, rng).slice(0, count);
}

// ── Cases — Akkusativ / Dativ / Genitiv articles + case pronouns ───────────
function syllableCount(word) {
  const groups = String(word || '').toLowerCase().match(/[aeiouyäöü]+/g);
  return groups ? groups.length : 1;
}

/** Monosyllables that take -s (not -es) in the Genitiv: der Sport → des Sports. */
const SYLLABIC_S_EXCEPTIONS = new Set(['sport', 'film', 'ball', 'plan', 'test', 'club', 'kurs', 'hals']);

/** des Vaters / des Tisches / des Hauses — the noun takes the genitive ending. */
function genitiveForm(word) {
  const w = String(word || '').trim();
  if (!w) return '';
  const low = w.toLowerCase();
  if (low.endsWith('e')) return w + 'n'; // der Junge → des Jungen
  if (/[sßxz]$/.test(low)) return w + 'es'; // das Haus → des Hauses
  if (SYLLABIC_S_EXCEPTIONS.has(low)) return w + 's'; // der Sport → des Sports
  if (syllableCount(w) === 1) return w + 'es'; // der Markt → des Marktes
  return w + 's'; // der Vater → des Vaters
}

/** The dative plural adds -n to the noun unless it already ends in -n/-s. */
function dativePluralNoun(plural) {
  const p = String(plural || '').trim();
  if (!p) return '';
  return /[ns]$/i.test(p) ? p : `${p}n`;
}

function nounCaseForm(article, caseKey, word, plural) {
  if (article === 'die') {
    if (caseKey === 'dat' && plural) return { article: 'den', noun: dativePluralNoun(plural) };
    if (caseKey === 'dat') return { article: 'der', noun: word };
    if (caseKey === 'gen') return { article: 'der', noun: word };
    return { article: 'die', noun: word };
  }
  if (article === 'der') {
    if (caseKey === 'akk') return { article: 'den', noun: word };
    if (caseKey === 'dat') return { article: 'dem', noun: word };
    if (caseKey === 'gen') return { article: 'des', noun: genitiveForm(word) };
    return { article: 'der', noun: word };
  }
  if (caseKey === 'dat') return { article: 'dem', noun: word };
  if (caseKey === 'gen') return { article: 'des', noun: genitiveForm(word) };
  return { article: 'das', noun: word };
}

const CASE_TEMPLATES = {
  akk: [
    (n) => `Ich sehe ___ ${n}.`,
    (n) => `Wir brauchen ___ ${n} heute.`,
    (n) => `Das ist für ___ ${n}.`,
    (n) => `Er kauft ___ ${n}.`,
    (n) => `Ohne ___ ${n} geht es nicht.`,
  ],
  dat: [
    (n) => `Ich helfe ___ ${n}.`,
    (n) => `Das gehört ___ ${n}.`,
    (n) => `Ich gebe ___ ${n} ein Buch.`,
    (n) => `Ich fahre mit ___ ${n}.`,
    (n) => `Das Buch liegt neben ___ ${n}.`,
  ],
  gen: [
    (n) => `Das Auto ___ ${n} ist neu.`,
    (n) => `Die Tasche ___ ${n} ist sehr alt.`,
    (n) => `Das Ende ___ ${n} kommt bald.`,
  ],
};

const CASE_LABELS = { akk: 'Akkusativ', dat: 'Dativ', gen: 'Genitiv' };
const ARTICLE_POOL = ['der', 'die', 'das', 'den', 'dem', 'des'];

const PRONOUN_CASE_QUESTIONS = [
  { caseKey: 'akk', hint: 'ich', answer: 'mich' },
  { caseKey: 'akk', hint: 'du', answer: 'dich' },
  { caseKey: 'akk', hint: 'er', answer: 'ihn' },
  { caseKey: 'akk', hint: 'sie (she)', answer: 'sie' },
  { caseKey: 'akk', hint: 'es', answer: 'es' },
  { caseKey: 'akk', hint: 'wir', answer: 'uns' },
  { caseKey: 'akk', hint: 'ihr', answer: 'euch' },
  { caseKey: 'akk', hint: 'sie (they)', answer: 'sie' },
  { caseKey: 'dat', hint: 'ich', answer: 'mir' },
  { caseKey: 'dat', hint: 'du', answer: 'dir' },
  { caseKey: 'dat', hint: 'er', answer: 'ihm' },
  { caseKey: 'dat', hint: 'sie (she)', answer: 'ihr' },
  { caseKey: 'dat', hint: 'wir', answer: 'uns' },
  { caseKey: 'dat', hint: 'ihr', answer: 'euch' },
  { caseKey: 'dat', hint: 'sie (they)', answer: 'ihnen' },
  { caseKey: 'dat', hint: 'Sie (formal)', answer: 'Ihnen' },
];

const PRONOUN_TEMPLATES = {
  akk: [(n) => `Ich sehe ___ . (${n})`, (n) => `Das ist ___ . (${n})`, (n) => `Wir brauchen ___ . (${n})`],
  dat: [(n) => `Ich helfe ___ . (${n})`, (n) => `Das gehört ___ . (${n})`, (n) => `Ich gebe ___ das Buch . (${n})`],
};
const PRONOUN_POOL = [...new Set(PRONOUN_CASE_QUESTIONS.map((p) => p.answer))];

function buildCasesQuestions(vocab, rng, count) {
  const nouns = vocab.filter((v) => v.article && v.wordType !== 'verb' && v.wordType !== 'adjective');
  const candidates = [];
  for (const v of nouns) {
    for (const caseKey of ['akk', 'dat']) {
      const form = nounCaseForm(v.article, caseKey, v.word, '');
      const templates = CASE_TEMPLATES[caseKey];
      const tpl = templates[Math.floor(rng() * templates.length)];
      const sentence = tpl(form.noun);
      candidates.push({
        type: 'cases', kind: 'choice',
        prompt: `Choose the correct Artikel — ${CASE_LABELS[caseKey]} (hint: ${form.noun}):`,
        question: sentence,
        options: pickOptions(form.article, ARTICLE_POOL.filter((a) => a !== form.article), rng),
        answer: form.article,
        translation: v.translation,
      });
    }
    const gen = nounCaseForm(v.article, 'gen', v.word, '');
    if (gen.noun) {
      const tpl = CASE_TEMPLATES.gen[Math.floor(rng() * CASE_TEMPLATES.gen.length)];
      candidates.push({
        type: 'cases', kind: 'choice',
        prompt: `Choose the correct Artikel — Genitiv (hint: ${gen.noun}):`,
        question: tpl(gen.noun),
        options: pickOptions(gen.article, ARTICLE_POOL.filter((a) => a !== gen.article), rng),
        answer: gen.article,
        translation: v.translation,
      });
    }
    if (hasUsablePlural(v)) {
      const form = nounCaseForm(v.article, 'dat', v.word, v.plural);
      if (form.article === 'den') {
        const tpl = CASE_TEMPLATES.dat[Math.floor(rng() * CASE_TEMPLATES.dat.length)];
        candidates.push({
          type: 'cases', kind: 'choice',
          prompt: `Choose the correct Artikel — Dativ Plural (hint: ${form.noun}):`,
          question: tpl(form.noun),
          options: pickOptions(form.article, ARTICLE_POOL.filter((a) => a !== form.article), rng),
          answer: form.article,
          translation: v.translation,
        });
      }
    }
  }
  if (hasChoiceOptions(PRONOUN_POOL)) {
    for (const p of PRONOUN_CASE_QUESTIONS) {
      const templates = PRONOUN_TEMPLATES[p.caseKey];
      const tpl = templates[Math.floor(rng() * templates.length)];
      candidates.push({
        type: 'cases', kind: 'choice',
        prompt: `Choose the ${CASE_LABELS[p.caseKey]} form of the pronoun "${p.hint}":`,
        question: tpl(p.hint),
        options: pickOptions(p.answer, PRONOUN_POOL.filter((a) => a !== p.answer), rng),
        answer: p.answer,
        translation: '',
      });
    }
  }
  return shuffleWithSeed(candidates, rng).slice(0, count);
}

// ── Komparativ & Superlativ of the course's adjectives ─────────────────────
const COMPARISON_OVERRIDES = {
  müde: ['müder', 'müdesten'],
  teuer: ['teurer', 'teuersten'],
  nachhaltig: ['nachhaltiger', 'nachhaltigsten'],
  global: ['globaler', 'globalsten'],
  überzeugend: ['überzeugender', 'überzeugendsten'],
  präzise: ['präziser', 'präzisesten'],
  präzis: ['präziser', 'präzisesten'],
  kulturell: ['kultureller', 'kulturellsten'],
  wissenschaftlich: ['wissenschaftlicher', 'wissenschaftlichsten'],
  nuanciert: ['nuancierter', 'nuanciertesten'],
  sachlich: ['sachlicher', 'sachlichsten'],
  strategisch: ['strategischer', 'strategischsten'],
  innovativ: ['innovativer', 'innovativsten'],
  stichhaltig: ['stichhaltiger', 'stichhaltigsten'],
  abstrakt: ['abstrakter', 'abstraktesten'],
  subtil: ['subtiler', 'subtilsten'],
  relevant: ['relevanter', 'relevantesten'],
  eloquent: ['eloquenter', 'eloquentesten'],
  differenziert: ['differenzierter', 'differenziertesten'],
  verbindlich: ['verbindlicher', 'verbindlichsten'],
  objektiv: ['objektiver', 'objektivsten'],
  // Irregulars — only used when such a word is part of the vocabulary list.
  gut: ['besser', 'besten'],
  schlecht: ['schlechter', 'schlechtesten'],
  groß: ['größer', 'größten'],
  hoch: ['höcher', 'höchsten'],
  viel: ['mehr', 'meisten'],
  gern: ['lieber', 'liebsten'],
  nah: ['näher', 'nächsten'],
  weit: ['weiter', 'weitesten'],
  alt: ['älter', 'ältesten'],
  jung: ['jünger', 'jüngsten'],
  warm: ['wärmer', 'wärmsten'],
  kalt: ['kälter', 'kältesten'],
  kurz: ['kürzer', 'kürzesten'],
  lang: ['länger', 'längsten'],
  schnell: ['schneller', 'schnellsten'],
  neu: ['neuer', 'neuesten'],
};

/** Adjective suffixes whose -er / -st forms are always regular. */
const SAFE_ADJECTIVE_SUFFIX = /(ig|isch|lich|sam|iv|ell|bar|end|ant|ent|ös|iv)$/i;

function deriveComparison(v) {
  const word = String(v.word || '').trim();
  if (!word) return null;
  const low = word.toLowerCase();
  if (v.comparative && v.superlative) {
    return { comparative: String(v.comparative).trim(), superlative: String(v.superlative).trim().replace(/^am\s+/i, '') };
  }
  if (COMPARISON_OVERRIDES[low]) {
    return { comparative: COMPARISON_OVERRIDES[low][0], superlative: COMPARISON_OVERRIDES[low][1] };
  }
  if (!SAFE_ADJECTIVE_SUFFIX.test(low)) return null;
  if (v.wordType !== 'adjective') return null;
  const stem = low.endsWith('e') && !low.endsWith('ee') ? low.slice(0, -1) : low;
  const superlative = stem + (/[dtsßz]$/.test(stem) ? 'est' : 'st') + 'en';
  return { comparative: `${stem}er`, superlative };
}

function buildComparisonQuestions(vocab, rng, count) {
  const adjectives = vocab
    .map((v) => ({ v, c: deriveComparison(v) }))
    .filter((x) => x.c && x.c.comparative && x.c.superlative);
  const comparatives = adjectives.map((x) => x.c.comparative);
  const candidates = [];
  for (const { v, c } of adjectives) {
    candidates.push({
      type: 'comparison', kind: 'text',
      prompt: 'Write the KOMPARATIV of this adjective:',
      question: v.word, options: null,
      answer: c.comparative, translation: v.translation,
    });
    candidates.push({
      type: 'comparison', kind: 'text',
      prompt: 'Write the SUPERLATIVE of this adjective (am …):',
      question: v.word, options: null,
      answer: c.superlative, alternates: [`am ${c.superlative}`], translation: v.translation,
    });
    if (hasChoiceOptions(comparatives)) {
      candidates.push({
        type: 'comparison', kind: 'choice',
        prompt: 'Choose the KOMPARATIV of this adjective:',
        question: v.word,
        options: pickOptions(c.comparative, comparatives.filter((x) => x !== c.comparative), rng),
        answer: c.comparative,
        translation: v.translation,
      });
    }
  }
  return shuffleWithSeed(candidates, rng).slice(0, count);
}

// ── Example sentences — fill the gap inside the word's own example ─────────
function blankedExample(v) {
  const example = String(v.example || '').trim();
  const target = String(v.word || '').trim();
  if (!example || !target) return '';
  return blankToken(example, target);
}

function buildExampleQuestions(vocab, rng, count) {
  const usable = vocab.filter((v) => blankedExample(v));
  const words = usable.map((v) => v.word);
  const candidates = [];
  for (const v of usable) {
    const blanked = blankedExample(v);
    candidates.push({
      type: 'example', kind: 'text',
      prompt: 'Fill the gap in this example sentence:',
      question: blanked, options: null,
      answer: v.word,
      translation: v.translation,
    });
    if (hasChoiceOptions(words)) {
      candidates.push({
        type: 'example', kind: 'choice',
        prompt: 'Which word belongs in the gap of this example sentence?',
        question: blanked,
        options: pickOptions(v.word, words.filter((w) => w !== v.word), rng),
        answer: v.word,
        translation: v.translation,
      });
    }
  }
  return shuffleWithSeed(candidates, rng).slice(0, count);
}

// ── Verb tables — write the Präsens form of a given verb + pronoun ─────────
function buildVerbFormQuestions(verbs, rng, count) {
  const usable = verbs.filter((v) => verbForms(v).length);
  const infinitives = usable.map((v) => v.infinitive);
  const allForms = usable.flatMap((v) => verbForms(v).map((f) => f.form));
  const candidates = [];
  for (const v of usable) {
    const forms = verbForms(v);
    const meaning = v.meaning ? ` (${v.meaning})` : '';
    for (const f of forms) {
      candidates.push({
        type: 'verbForm', kind: 'text',
        prompt: `Write the Präsens form of "${v.infinitive}"${meaning} for:`,
        question: f.label, options: null,
        answer: f.form,
        alternates: f.form.includes(' ') ? [f.form.split(' ')[0]] : undefined,
        translation: v.meaning,
      });
      const otherForms = allForms.filter((x) => x !== f.form);
      if (hasChoiceOptions(otherForms.concat(f.form))) {
        candidates.push({
          type: 'verbForm', kind: 'choice',
          prompt: `Choose the correct Präsens form of "${v.infinitive}"${meaning} for:`,
          question: f.label,
          options: pickOptions(f.form, otherForms, rng),
          answer: f.form,
          translation: v.meaning,
        });
      }
      if (hasChoiceOptions(infinitives)) {
        candidates.push({
          type: 'verbForm', kind: 'choice',
          prompt: `Which verb does this Präsens form belong to? (${f.label})`,
          question: f.form,
          options: pickOptions(v.infinitive, infinitives.filter((i) => i !== v.infinitive), rng),
          answer: v.infinitive,
          translation: v.meaning,
        });
      }
    }
    if (v.pastParticiple) {
      candidates.push({
        type: 'verbForm', kind: 'text',
        prompt: `Write the Partizip II (Perfekt) of "${v.infinitive}"${meaning}:`,
        question: v.infinitive, options: null,
        answer: v.pastParticiple, translation: v.meaning,
      });
    }
  }
  return shuffleWithSeed(candidates, rng).slice(0, count);
}

// ── Expressions — the Redemittel of every level ────────────────────────────
function buildExpressionQuestions(expressions, rng, count) {
  const phrases = expressions.map((e) => e.phrase);
  const translations = expressions.map((e) => e.translation);
  const candidates = [];
  for (const e of expressions) {
    const enAlts = [stripEnglishArticle(e.translation)].filter(Boolean);
    if (hasChoiceOptions(translations)) {
      candidates.push({
        type: 'expression', kind: 'choice',
        prompt: 'Choose the ENGLISH translation of this expression:',
        question: e.phrase,
        options: pickOptions(e.translation, translations.filter((t) => t !== e.translation), rng),
        answer: e.translation,
        translation: e.translation,
      });
      candidates.push({
        type: 'expression', kind: 'choice',
        prompt: 'Choose the GERMAN expression:',
        question: e.translation,
        options: pickOptions(e.phrase, phrases.filter((p) => p !== e.phrase), rng),
        answer: e.phrase,
        translation: e.translation,
      });
    }
    candidates.push({
      type: 'expression', kind: 'text',
      prompt: 'Translate this expression into ENGLISH:',
      question: e.phrase, options: null,
      answer: e.translation, alternates: enAlts, translation: e.translation,
    });
    candidates.push({
      type: 'expression', kind: 'text',
      prompt: 'Write this expression in GERMAN:',
      question: e.translation, options: null,
      answer: e.phrase, translation: e.translation,
    });
  }
  return shuffleWithSeed(candidates, rng).slice(0, count);
}

// ── Idioms — phrase ⇄ meaning ⇄ translation ────────────────────────────────
function buildIdiomQuestions(idioms, rng, count) {
  const phrases = idioms.map((i) => i.phrase);
  const meanings = idioms.map((i) => i.meaning).filter(Boolean);
  const candidates = [];
  for (const i of idioms) {
    if (i.meaning && hasChoiceOptions(meanings)) {
      candidates.push({
        type: 'idiom', kind: 'choice',
        prompt: 'What does this idiom mean?',
        question: i.phrase,
        options: pickOptions(i.meaning, meanings.filter((m) => m !== i.meaning), rng),
        answer: i.meaning,
        translation: i.translation,
      });
      candidates.push({
        type: 'idiom', kind: 'choice',
        prompt: 'Which German idiom is this?',
        question: i.meaning,
        options: pickOptions(i.phrase, phrases.filter((p) => p !== i.phrase), rng),
        answer: i.phrase,
        translation: i.translation,
      });
    }
    if (i.translation) {
      const enAlts = [stripEnglishArticle(i.translation)].filter(Boolean);
      candidates.push({
        type: 'idiom', kind: 'text',
        prompt: 'Translate this idiom into ENGLISH:',
        question: i.phrase, options: null,
        answer: i.translation, alternates: enAlts, translation: i.translation,
      });
      if (i.usage) {
        candidates.push({
          type: 'idiom', kind: 'text',
          prompt: 'In which situation do you use this idiom? (short answer)',
          question: i.phrase, options: null,
          answer: i.meaning || i.translation,
          alternates: [i.translation].filter(Boolean),
          translation: i.translation,
        });
      }
    }
  }
  return shuffleWithSeed(candidates, rng).slice(0, count);
}

// ── Common mistakes — find and correct the typical error ───────────────────
function buildMistakeQuestions(mistakes, rng, count) {
  const corrects = mistakes.map((m) => m.correct);
  const incorrects = mistakes.map((m) => m.incorrect);
  const candidates = [];
  for (const m of mistakes) {
    candidates.push({
      type: 'mistake', kind: 'text',
      prompt: 'Find the mistake and write the CORRECT sentence:',
      question: m.incorrect, options: null,
      answer: m.correct, translation: m.why,
    });
    if (hasChoiceOptions(corrects)) {
      candidates.push({
        type: 'mistake', kind: 'choice',
        prompt: 'Which is the CORRECT version of this sentence?',
        question: m.incorrect,
        options: pickOptions(m.correct, corrects.filter((c) => c !== m.correct), rng),
        answer: m.correct,
        translation: m.why,
      });
    }
    if (hasChoiceOptions(incorrects)) {
      candidates.push({
        type: 'mistake', kind: 'choice',
        prompt: 'Which of these sentences contains the MISTAKE?',
        question: m.correct,
        options: pickOptions(m.incorrect, incorrects.filter((c) => c !== m.incorrect), rng),
        answer: m.incorrect,
        translation: m.why,
      });
    }
    if (m.why) {
      const whys = mistakes.map((x) => x.why).filter(Boolean);
      if (hasChoiceOptions(whys)) {
        candidates.push({
          type: 'mistake', kind: 'choice',
          prompt: 'Why is this sentence wrong?',
          question: m.incorrect,
          options: pickOptions(m.why, whys.filter((w) => w !== m.why), rng),
          answer: m.why,
          translation: m.correct,
        });
      }
    }
  }
  return shuffleWithSeed(candidates, rng).slice(0, count);
}

// ── Dialogues — pick the right reply or the speaker ────────────────────────
function buildDialogueQuestions(dialogues, rng, count) {
  const names = [...new Set(dialogues.flatMap((d) => d.participants))];
  const candidates = [];
  for (const d of dialogues) {
    const otherLines = dialogues
      .filter((o) => o !== d)
      .flatMap((o) => o.exchanges.map((e) => e.text));
    for (let i = 0; i + 1 < d.exchanges.length; i++) {
      const current = d.exchanges[i];
      const reply = d.exchanges[i + 1];
      const distractors = otherLines.concat(
        d.exchanges.filter((e, idx) => idx !== i && idx !== i + 1).map((e) => e.text)
      );
      if (!hasChoiceOptions(distractors.concat(reply.text))) continue;
      candidates.push({
        type: 'dialogue', kind: 'choice',
        prompt: `Choose the appropriate reply${d.title ? ` in "${d.title}"` : ''}:`,
        question: current.text,
        options: pickOptions(reply.text, distractors, rng),
        answer: reply.text,
        translation: reply.translation || current.translation || '',
      });
    }
    if (hasChoiceOptions(names)) {
      for (const e of d.exchanges) {
        const speaker = d.participants[e.speakerIndex];
        if (!speaker) continue;
        candidates.push({
          type: 'dialogue', kind: 'choice',
          prompt: `Who says this line${d.title ? ` in "${d.title}"` : ''}?`,
          question: e.text,
          options: pickOptions(speaker, names.filter((n) => n !== speaker), rng),
          answer: speaker,
          translation: e.translation || '',
        });
      }
    }
  }
  return shuffleWithSeed(candidates, rng).slice(0, count);
}

// ── Alphabet, pronunciation & the umlauts ä ö ü ß ──────────────────────────
function buildAlphabetQuestions(records, chapterId, rng, count) {
  // The alphabet (letters AND the umlauts) belongs to the course as a whole,
  // never to a single chapter — chapter tests stay 100 % chapter content.
  if (chapterId) return [];
  const letters = poolAlphabet(records, chapterId);
  const specials = SPECIAL_CHARS;
  const allChars = letters.map((a) => a.letter).concat(specials.map((s) => s.letter));
  const allPronunciations = letters.map((a) => a.pronunciation).filter(Boolean);
  const allExamples = letters.map((a) => a.example).filter(Boolean).concat(specials.map((s) => s.example));
  const candidates = [];

  for (const a of letters) {
    if (a.pronunciation && hasChoiceOptions(allPronunciations)) {
      candidates.push({
        type: 'alphabet', kind: 'choice',
        prompt: 'How is this letter pronounced?',
        question: a.letter,
        options: pickOptions(a.pronunciation, allPronunciations.filter((p) => p !== a.pronunciation), rng),
        answer: a.pronunciation,
        translation: a.english,
      });
      candidates.push({
        type: 'alphabet', kind: 'choice',
        prompt: 'Which letter is pronounced like this?',
        question: a.pronunciation,
        options: pickOptions(a.letter, allChars.filter((c) => c !== a.letter), rng),
        answer: a.letter,
        translation: a.english,
      });
      candidates.push({
        type: 'alphabet', kind: 'text',
        prompt: 'How is this letter pronounced? (write it the way you read it)',
        question: a.letter, options: null,
        answer: a.pronunciation, translation: a.english,
      });
    }
    if (a.example && hasChoiceOptions(allExamples)) {
      candidates.push({
        type: 'alphabet', kind: 'choice',
        prompt: 'Which example word starts with this letter?',
        question: a.letter,
        options: pickOptions(a.example, allExamples.filter((x) => x !== a.example), rng),
        answer: a.example,
        translation: a.english,
      });
      candidates.push({
        type: 'alphabet', kind: 'choice',
        prompt: 'Which letter does this German word begin with?',
        question: a.example,
        options: pickOptions(a.letter, allChars.filter((c) => c !== a.letter), rng),
        answer: a.letter,
        translation: a.english,
      });
    }
  }

  const specialChars = specials.map((s) => s.letter);
  for (const s of specials) {
    candidates.push({
      type: 'alphabet', kind: 'choice',
      prompt: 'Which special character (Umlaut / ß) does this word contain?',
      question: s.example,
      options: pickOptions(s.letter, specialChars.filter((c) => c !== s.letter), rng),
      answer: s.letter,
      translation: s.english,
    });
    if (hasChoiceOptions(allExamples)) {
      candidates.push({
        type: 'alphabet', kind: 'choice',
        prompt: 'Choose an example word for this special character:',
        question: s.letter,
        options: pickOptions(s.example, allExamples.filter((x) => x !== s.example), rng),
        answer: s.example,
        translation: s.english,
      });
    }
    if (hasChoiceOptions(allPronunciations)) {
      candidates.push({
        type: 'alphabet', kind: 'text',
        prompt: `How is the special character "${s.letter}" pronounced?`,
        question: s.letter, options: null,
        answer: s.pronunciation, translation: s.english,
      });
    }
  }

  return shuffleWithSeed(candidates, rng).slice(0, count);
}

// ── Public API ──────────────────────────────────────────────────────────────
export const EXERCISE_TYPES = [
  { value: 'mixed', label: 'Mixed Test', hint: 'Every course part in one test' },
  { value: 'article', label: 'Articles', hint: 'Guess der / die / das for each word' },
  { value: 'picture', label: 'Picture Round', hint: 'See the image → write Artikel, word, feminine form & plural' },
  { value: 'gender', label: 'Masculine → Feminine', hint: 'Choose the feminine form of a masculine noun' },
  { value: 'plural', label: 'Plural Forms', hint: 'Write down the plural of the given word' },
  { value: 'translation', label: 'Translations', hint: 'Vocabulary DE ⇄ EN, written and as multiple choice' },
  { value: 'example', label: 'Example Sentences', hint: 'Fill the gap inside the word’s own example' },
  { value: 'cases', label: 'Cases & Prepositions', hint: 'Akkusativ, Dativ, Genitiv articles & case pronouns' },
  { value: 'comparison', label: 'Komparativ & Superlativ', hint: 'The comparative and superlative of the adjectives' },
  { value: 'possessive', label: 'Possessive Articles', hint: 'Fill in mein / dein / sein … with the right ending' },
  { value: 'conjugation', label: 'Verb Conjugation', hint: 'Choose the right verb of this chapter & write its Präsens form' },
  { value: 'verbForm', label: 'Verb Tables', hint: 'Write the Präsens form for a given verb + pronoun' },
  { value: 'grammar', label: 'Grammar Rules', hint: 'Match the rules with their examples & fill their gaps' },
  { value: 'expression', label: 'Expressions', hint: 'The Redemittel of the level: phrase ⇄ translation' },
  { value: 'idiom', label: 'Idioms', hint: 'Idiom ⇄ meaning ⇄ translation' },
  { value: 'mistake', label: 'Common Mistakes', hint: 'Find the error and write the correct sentence' },
  { value: 'dialogue', label: 'Dialogues', hint: 'Pick the right reply or the speaker of a dialogue' },
  { value: 'alphabet', label: 'Alphabet & Umlaute', hint: 'Letters, pronunciation, example words & ä ö ü ß' },
  { value: 'numbers', label: 'Numbers', hint: 'German numbers 0–999, both directions' },
];

export function exerciseTypeLabel(type) {
  const found = EXERCISE_TYPES.find((t) => t.value === type);
  return found ? found.label : 'Mixed Test';
}

/**
 * The record kinds that can fuel an exercise (what BUILDERS reads). Anything
 * else — chapters, notes, stories, saved results … — is ignored.
 */
export const EXERCISE_SOURCE_TYPES = [
  'vocab', 'unified-vocab', 'grammar', 'verb', 'dialogue', 'expression', 'idiom', 'mistake', 'alphabet',
];

/**
 * Keep only the records the exercise generators can use. Report/PDF writers
 * call this before generating a worksheet, so a chapter's practice test is
 * built from its grammar, verbs, dialogues, expressions … and not just its
 * vocabulary.
 */
export function exerciseSourceRecords(records) {
  return (Array.isArray(records) ? records : []).filter((r) => r && EXERCISE_SOURCE_TYPES.includes(r.type));
}

/**
 * The scoped pools shared by counting and generating, so the "available"
 * badges always match what the generator can really produce.
 */
function buildContext(records, chapterId) {
  return {
    records,
    chapterId,
    vocab: scopeVocab(records, chapterId),
    verbs: scopeVerbs(records, chapterId).filter((v) => verbForms(v).length),
    grammar: poolGrammar(records, chapterId),
    expressions: poolExpressions(records, chapterId),
    idioms: poolIdioms(records, chapterId),
    mistakes: poolMistakes(records, chapterId),
    dialogues: poolDialogues(records, chapterId),
  };
}

/** One builder per exercise type — `type` values are the keys of this map. */
const BUILDERS = {
  article: (ctx, rng, n) => buildArticleQuestions(ctx.vocab, rng, n),
  picture: (ctx, rng, n) => buildPictureQuestions(ctx.vocab, rng, n),
  gender: (ctx, rng, n) => buildGenderQuestions(ctx.vocab, rng, n),
  plural: (ctx, rng, n) => buildPluralQuestions(ctx.vocab, rng, n),
  possessive: (ctx, rng, n) => buildPossessiveQuestions(ctx.vocab, rng, n),
  conjugation: (ctx, rng, n) => buildConjugationQuestions(scopeConjugationVerbs(ctx.records, ctx.chapterId), rng, n),
  numbers: (ctx, rng, n) => buildNumberQuestions(rng, n),
  translation: (ctx, rng, n) => buildTranslationQuestions(ctx.vocab, rng, n),
  example: (ctx, rng, n) => buildExampleQuestions(ctx.vocab, rng, n),
  cases: (ctx, rng, n) => buildCasesQuestions(ctx.vocab, rng, n),
  comparison: (ctx, rng, n) => buildComparisonQuestions(ctx.vocab, rng, n),
  verbForm: (ctx, rng, n) => buildVerbFormQuestions(ctx.verbs, rng, n),
  grammar: (ctx, rng, n) => buildGrammarQuestions(ctx.grammar, rng, n),
  expression: (ctx, rng, n) => buildExpressionQuestions(ctx.expressions, rng, n),
  idiom: (ctx, rng, n) => buildIdiomQuestions(ctx.idioms, rng, n),
  mistake: (ctx, rng, n) => buildMistakeQuestions(ctx.mistakes, rng, n),
  dialogue: (ctx, rng, n) => buildDialogueQuestions(ctx.dialogues, rng, n),
  alphabet: (ctx, rng, n) => buildAlphabetQuestions(ctx.records, ctx.chapterId, rng, n),
};

/** Sampling order of a mixed test — every course part gets a slice. */
const MIXED_ORDER = [
  'article', 'picture', 'gender', 'plural', 'translation', 'example', 'cases',
  'comparison', 'possessive', 'conjugation', 'verbForm', 'grammar', 'expression',
  'idiom', 'mistake', 'dialogue', 'alphabet', 'numbers',
];

/** Availability probe — big enough for every pool, small enough to stay fast. */
const AVAILABILITY_LIMIT = 1000;

/**
 * How many questions each type can produce (capped at `limit`). Badges pass
 * the big AVAILABILITY_LIMIT to show the real pool size; generateExercises
 * probes with the small wanted-count, which is all it needs to know which
 * types are active for a mixed test.
 */
function countForContext(ctx, limit = AVAILABILITY_LIMIT) {
  const rng = makeRng('available');
  const counts = { words: ctx.vocab.length, numbers: 999 };
  for (const key of Object.keys(BUILDERS)) {
    counts[key] = key === 'numbers' ? 999 : BUILDERS[key](ctx, rng, limit).length;
  }
  return counts;
}

/**
 * How many questions each type can produce for a given scope — powers the
 * "available" badges in the Exercises tab and the start-button guard.
 */
export function countAvailableExercises(records, chapterId = null) {
  return countForContext(buildContext(records, chapterId));
}

/**
 * Generate a test. Loops the records of the given scope (one chapter, or
 * the entire database when chapterId is null/undefined).
 *
 * @param {Object}   opts
 * @param {Array}    opts.records  raw German records (vocab + grammar + verbs + …)
 * @param {string}   [opts.chapterId] only use this chapter's records
 * @param {string}   [opts.type]   any value of EXERCISE_TYPES ('mixed' blends them all)
 * @param {number}   [opts.count]  max number of questions (default 10)
 * @param {number|string} [opts.seed] seed → deterministic output (PDF worksheets)
 * @param {boolean}  [opts.includeNumbers] mixed tests also ask numbers (default true).
 *                   Set to false for strict chapter tests — every question then
 *                   comes from that chapter's own course content.
 * @returns {{ questions: Array, scopedWords: number }}
 */
export function generateExercises({ records = [], chapterId = null, type = 'mixed', count = 10, seed = null, includeNumbers = true } = {}) {
  const rng = makeRng(seed);
  const ctx = buildContext(records, chapterId);
  const wanted = Math.max(1, Math.min(60, Number(count) || 10));
  const withNumbers = includeNumbers !== false;

  let questions = [];
  if (type !== 'mixed' && BUILDERS[type]) {
    questions = BUILDERS[type](ctx, rng, wanted);
  } else {
    // Mixed test — every available type gets a slice of the question budget,
    // so one test really covers the whole course: words, grammar, verbs,
    // expressions, idioms, mistakes, dialogues, alphabet …
    const counts = countForContext(ctx, wanted);
    const active = MIXED_ORDER.filter((k) => (counts[k] || 0) > 0 && (k !== 'numbers' || withNumbers));
    if (active.length) {
      const per = Math.max(1, Math.round(wanted / active.length));
      questions = active.flatMap((key) => BUILDERS[key](ctx, rng, per));
      questions = shuffleWithSeed(questions, rng).slice(0, wanted);
    }
  }

  questions = questions.slice(0, wanted);
  questions.forEach((q, i) => { q.id = i + 1; });
  return { questions, scopedWords: ctx.vocab.length };
}

/** Fold a typed German answer for tolerant comparison (umlauts, articles, case). */
const foldText = (s) => String(s || '')
  .toLowerCase()
  .trim()
  .replace(/^(der|die|das|den|dem|des|ein|eine|einen|einem|einer)\s+/, '')
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]/g, '');

function textEquals(expected, given) {
  const a = foldText(expected);
  const b = foldText(given);
  return !!(a && b && a === b);
}

/** Check ONE part of a multi-part (picture) question against its input. */
export function checkAnswerPart(part, given) {
  if (!part) return false;
  if (part.kind === 'choice') return String(given ?? '').trim() === String(part.answer ?? '').trim();
  if (textEquals(part.answer, given)) return true;
  // extra accepted spellings (e.g. separable verb "stehe auf" → "stehe")
  return Array.isArray(part.alternates) && part.alternates.some((alt) => textEquals(alt, given));
}

/** Answer checking — tolerant for typed answers (umlauts, articles, case). */
export function checkAnswer(question, given) {
  if (!question) return false;
  if (question.kind === 'choice') return String(given ?? '').trim() === String(question.answer ?? '').trim();
  if (question.kind === 'multi') {
    // Picture round: `given` is an object { article, word, feminine, plural }
    // and the question only counts as solved when EVERY part is right.
    const parts = Array.isArray(question.parts) ? question.parts : [];
    if (!parts.length) return false;
    const g = given && typeof given === 'object' ? given : {};
    return parts.every((p) => checkAnswerPart(p, g[p.key]));
  }
  if (textEquals(question.answer, given)) return true;
  // extra accepted spellings ("the family" / "family", separable "stehe auf" → "stehe")
  return Array.isArray(question.alternates) && question.alternates.some((alt) => textEquals(alt, given));
}

/** Build the payload stored as an `exercise` record (see backend addExerciseResult). */
export function buildExerciseResultPayload({ questions, answers, kind, chapterId, chapterTitle, level }) {
  const byType = {};
  const wrongAnswers = [];
  let correct = 0;
  let total = 0;
  const tally = (type, ok, wrongEntry) => {
    if (!byType[type]) byType[type] = { total: 0, correct: 0 };
    byType[type].total += 1;
    total += 1;
    if (ok) {
      correct += 1;
      byType[type].correct += 1;
    } else {
      wrongAnswers.push(wrongEntry);
    }
  };
  (questions || []).forEach((q, i) => {
    const given = answers ? answers[i] : undefined;
    // Multi-part (picture) questions are scored PART BY PART: the Artikel, the
    // word, the feminine form and the plural each count as one answer, so the
    // final score shows exactly which of the four steps the user missed.
    if (q.kind === 'multi' && Array.isArray(q.parts) && q.parts.length) {
      const g = given && typeof given === 'object' ? given : {};
      q.parts.forEach((p) => {
        const partGiven = g[p.key];
        tally(q.type, checkAnswerPart(p, partGiven), {
          type: q.type,
          question: `${q.question}${p.label ? ` — ${p.label}` : ''}`,
          answer: String(p.answer ?? ''),
          given: partGiven == null || partGiven === '' ? '—' : String(partGiven),
        });
      });
      return;
    }
    tally(q.type, checkAnswer(q, given), {
      type: q.type,
      question: `${q.question}`,
      answer: String(q.answer ?? ''),
      given: given == null || given === '' ? '—' : String(given),
    });
  });
  return {
    kind: kind || 'mixed',
    chapterId: chapterId || null,
    chapterTitle: chapterTitle || '',
    level: level || 'A1.1',
    total,
    correct,
    byType,
    wrongAnswers: wrongAnswers.slice(0, 40),
  };
}

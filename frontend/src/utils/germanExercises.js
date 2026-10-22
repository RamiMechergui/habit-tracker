/**
 * germanExercises.js — Knowledge-test engine for the German Learning section.
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure JavaScript (no React, no DOM) so the SAME generator is used by:
 *   • the interactive "Exercises" tab (GermanExercises.jsx)
 *   • the PDF report (germanPdfBuilder.js + components/GermanReport.jsx)
 *
 * Exercise types:
 *   article    → guess the Artikel (der / die / das) of a noun from the vocab list
 *   picture    → see the vocabulary PHOTO, then write the Artikel, the word,
 *                its feminine form and the plural (multi-part question)
 *   conjugation → choose the most suitable verb of the chapter for a sentence,
 *                 then write its Präsens form for a given pronoun (multi-part)
 *   gender     → choose the feminine form of a masculine noun (der Student → die Studentin)
 *   plural     → write down the plural of the given word
 *   possessive → solve fill-in exercises about possessive articles (mein/dein/sein…)
 *   numbers    → numbers in German (write / recognize 0–999)
 *   mixed      → a bit of everything
 *
 * Scoping: every generator loops the vocabulary list it is given. When a
 * chapterId is supplied only that chapter's records are used, otherwise the
 * WHOLE database is looped ("All chapters" mode).
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

// ── Public API ──────────────────────────────────────────────────────────────
export const EXERCISE_TYPES = [
  { value: 'mixed', label: 'Mixed Test', hint: 'Articles, genders, plurals, possessives & numbers' },
  { value: 'article', label: 'Articles', hint: 'Guess der / die / das for each word' },
  { value: 'picture', label: 'Picture Round', hint: 'See the image → write Artikel, word, feminine form & plural' },
  { value: 'gender', label: 'Masculine → Feminine', hint: 'Choose the feminine form of a masculine noun' },
  { value: 'plural', label: 'Plural Forms', hint: 'Write down the plural of the given word' },
  { value: 'conjugation', label: 'Verb Conjugation', hint: 'Choose the right verb of this chapter & write its Präsens form' },
  { value: 'possessive', label: 'Possessive Articles', hint: 'Fill in mein / dein / sein … with the right ending' },
  { value: 'numbers', label: 'Numbers', hint: 'German numbers 0–999, both directions' },
];

export function exerciseTypeLabel(type) {
  const found = EXERCISE_TYPES.find((t) => t.value === type);
  return found ? found.label : 'Mixed Test';
}

/**
 * How many questions each type can produce for a given scope — powers the
 * "available" badges in the Exercises tab and the start-button guard.
 */
export function countAvailableExercises(records, chapterId = null) {
  const vocab = scopeVocab(records, chapterId);
  const genderPool = vocab.filter((v) => deriveFeminine(v.article, v.word, v.translation));
  const pluralPool = vocab.filter((v) => {
    const plural = String(v.plural || '').trim();
    return plural && !PLURAL_PLACEHOLDERS.has(plural.toLowerCase()) && plural.toLowerCase() !== v.word.toLowerCase();
  });
  const nounPool = vocab.filter((v) => v.article && v.wordType !== 'verb' && v.wordType !== 'adjective');
  const possessivePool = nounPool.length ? Math.max(nounPool.length, pluralPool.length) : 0;
  return {
    words: vocab.length,
    article: vocab.filter((v) => v.article && v.wordType !== 'verb' && v.wordType !== 'adjective').length,
    picture: vocab.filter((v) => v.photoUrl && v.article && v.wordType !== 'verb' && v.wordType !== 'adjective').length,
    gender: genderPool.length,
    plural: pluralPool.length,
    possessive: possessivePool,
    conjugation: scopeConjugationVerbs(records, chapterId).length,
    numbers: 999,
  };
}

/**
 * Generate a test. Loops the vocabulary of the given scope (one chapter, or
 * the entire database when chapterId is null/undefined).
 *
 * @param {Object}   opts
 * @param {Array}    opts.records  raw German records (vocab + unified-vocab + …)
 * @param {string}   [opts.chapterId] only use this chapter's vocabulary
 * @param {string}   [opts.type]   'mixed' | 'article' | 'picture' | 'gender' | 'plural' | 'conjugation' | 'possessive' | 'numbers'
 * @param {number}   [opts.count]  max number of questions (default 10)
 * @param {number|string} [opts.seed] seed → deterministic output (PDF worksheets)
 * @param {boolean}  [opts.includeNumbers] mixed tests also ask numbers (default true).
 *                   Set to false for strict chapter tests — every question then
 *                   comes from that chapter's own vocabulary.
 * @returns {{ questions: Array, scopedWords: number }}
 */
export function generateExercises({ records = [], chapterId = null, type = 'mixed', count = 10, seed = null, includeNumbers = true } = {}) {
  const rng = makeRng(seed);
  const vocab = scopeVocab(records, chapterId);
  const wanted = Math.max(1, Math.min(60, Number(count) || 10));
  const withNumbers = includeNumbers !== false;

  let questions = [];
  if (type === 'article') questions = buildArticleQuestions(vocab, rng, wanted);
  else if (type === 'picture') questions = buildPictureQuestions(vocab, rng, wanted);
  else if (type === 'gender') questions = buildGenderQuestions(vocab, rng, wanted);
  else if (type === 'plural') questions = buildPluralQuestions(vocab, rng, wanted);
  else if (type === 'conjugation') questions = buildConjugationQuestions(scopeConjugationVerbs(records, chapterId), rng, wanted);
  else if (type === 'possessive') questions = buildPossessiveQuestions(vocab, rng, wanted);
  else if (type === 'numbers') questions = buildNumberQuestions(rng, wanted);
  else {
    // Mixed test — every type gets a slice of the question budget. Without
    // numbers the budget is shared by the four vocabulary-driven types only,
    // so a chapter test stays 100% about that chapter's words.
    const builders = [
      (per) => buildArticleQuestions(vocab, rng, per),
      (per) => buildGenderQuestions(vocab, rng, per),
      (per) => buildPluralQuestions(vocab, rng, per),
      (per) => buildPossessiveQuestions(vocab, rng, per),
    ];
    if (withNumbers) builders.push((per) => buildNumberQuestions(rng, per));
    const per = Math.max(1, Math.round(wanted / builders.length));
    questions = builders.flatMap((build) => build(per));
    questions = shuffleWithSeed(questions, rng).slice(0, wanted);
  }

  questions = questions.slice(0, wanted);
  questions.forEach((q, i) => { q.id = i + 1; });
  return { questions, scopedWords: vocab.length };
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
  return textEquals(question.answer, given);
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

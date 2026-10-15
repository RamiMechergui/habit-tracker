/**
 * services/vocabPhoto.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Descriptive explicative photos for German vocabulary.
 *
 * Primary source: Wikimedia Commons API (free, no key, hotlink-friendly).
 *   Real photographs matching the word's meaning, downloaded server-side and
 *   cached in MinIO/S3 so DB `photoUrl` stays self-hosted like manual
 *   uploads. Author/license attribution is stored in `photoCredit`.
 * Fallback source: Pollinations.ai generated illustration (free, no key).
 *
 * DB provenance is tracked in `photoSource`:
 *   'wikimedia-commons' | 'ai-pollinations' | 'manual'
 */

const storage = require('./storage');
const { updateVocab, updateUnifiedVocab } = require('../db/german');

const WIKIMEDIA_API = 'https://commons.wikimedia.org/w/api.php';
const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';
const APP_UA = 'EvolvioHabitTracker/2.0 (german vocab photos)';

const WORD_ARTICLES = new Set(['der', 'die', 'das', 'den', 'dem', 'des']);
const GOOD_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Strip a leading German article ("der Apfel" → "Apfel"). */
function stripArticle(word) {
  if (!word) return '';
  const parts = String(word).trim().split(/\s+/);
  if (parts.length > 1 && WORD_ARTICLES.has(parts[0].toLowerCase())) {
    return parts.slice(1).join(' ');
  }
  return String(word).trim();
}

/** Strip HTML tags (Commons attribution comes as HTML). */
function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Best Commons search keyword for a vocab record.
 * Prefers the first Latin-script English segment of the translation
 * ("pilot (male)" → "pilot", "light / easy" → "light"), because gender
 * hints and slashes pollute image search.
 */
function searchKeyword(vocab = {}) {
  const raw = String(vocab.translation || '').split('/')[0].split(',')[0].split(';')[0];
  const latin = raw.replace(/\([^)]*\)/g, ' ').match(/[\p{Script=Latin}][\p{Script=Latin}\s'-]*/u);
  const cleaned = (latin ? latin[0] : '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (cleaned) return cleaned;
  const german = stripArticle(vocab.word || '').replace(/[^\p{L}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return german;
}

/** Deterministic 32-bit hash (djb2) → stable Pollinations seed. */
function stableSeed(str) {
  let h = 5381;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h % 1000000;
}

/**
 * AI prompt for the Pollinations fallback. Uses the English translation as
 * the visual subject plus the German word for context.
 */
function buildPhotoPrompt(vocab = {}) {
  const word = stripArticle(vocab.word || '');
  const translation = searchKeyword(vocab) || word;
  const wordType = (vocab.wordType || vocab.partOfSpeech || '').toLowerCase();
  const category = String(vocab.category || vocab.entryCategory || '').trim();

  let subjectHint = `representing "${translation}"`;
  if (word) subjectHint += ` (German: "${word.slice(0, 40)}")`;
  if (wordType.includes('verb')) {
    subjectHint += '. Show a person performing this action, dynamic simple scene';
  } else if (wordType.includes('adjective') || wordType.includes('adverb')) {
    subjectHint += '. Visualise this quality clearly through the scene and colours';
  } else {
    subjectHint += '. Single centered object or clear scene';
  }
  if (category && category.toLowerCase() !== 'general') {
    subjectHint += `, ${category} context`;
  }
  return (
    `Simple educational language-flashcard illustration ${subjectHint}. ` +
    `Bright flat vector style, plain light background, high contrast, ` +
    `no text, no words, no letters, no watermark`
  ).slice(0, 400);
}

/** Direct Pollinations.ai image URL (no fetch needed for preview). */
function pollinationsUrl(prompt, seed, width = 640, height = 400) {
  return (
    `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}` +
    `?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`
  );
}

function previewForVocab(vocab = {}, width = 640, height = 400) {
  const prompt = buildPhotoPrompt(vocab);
  const seed = stableSeed(`${vocab.recordId || vocab.word}|${vocab.translation}`);
  return { prompt, seed, url: pollinationsUrl(prompt, seed, width, height) };
}

async function fetchWithTimeout(url, ms = 60000, accept = 'image/*,*/*;q=0.8') {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': APP_UA, Accept: accept },
    });
    if (!res.ok) throw new Error(`Image fetch failed with status ${res.status}`);
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function readImageBuffer(res) {
  const contentType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  if (!contentType.startsWith('image/')) {
    throw new Error(`Unexpected content-type "${contentType}"`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 1024) throw new Error('Image payload too small, likely an error page');
  return { buffer, contentType };
}

// ── Wikimedia Commons ────────────────────────────────────────────────────────

async function searchCommons(keyword, limit = 8) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${keyword} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|user|extmetadata',
    iiurlwidth: '800',
  });
  const res = await fetchWithTimeout(`${WIKIMEDIA_API}?${params.toString()}`, 25000, 'application/json');
  const json = await res.json();
  return Object.values(json?.query?.pages || {});
}

function pickCommonsImage(pages) {
  const infos = [];
  for (const p of pages) {
    const ii = p?.imageinfo?.[0];
    if (!ii || !GOOD_MIME.has(ii.mime)) continue;
    if (!ii.url) continue;
    infos.push({ page: p, info: ii });
  }
  // Prefer a reasonably large original so the 800px thumb looks crisp.
  infos.sort((a, b) => {
    const aBig = (a.info.width || 0) >= 800 ? 0 : 1;
    const bBig = (b.info.width || 0) >= 800 ? 0 : 1;
    return aBig - bBig;
  });
  return infos[0] || null;
}

function commonsCredit(info) {
  const meta = info?.extmetadata || {};
  const artist = stripHtml(meta.Artist?.value || info?.user || '').slice(0, 120);
  const license = stripHtml(meta.LicenseShortName?.value || '').slice(0, 40);
  const credit = [artist, license && `(${license})`].filter(Boolean).join(' ').trim();
  return `${credit} — Wikimedia Commons`.slice(0, 200);
}

/**
 * Find + download the most descriptive Commons photo for a vocab record.
 * Tries the English keyword, then the German word, then the category.
 */
async function fetchWikimediaPhoto(vocab = {}) {
  const candidates = [
    searchKeyword(vocab),
    stripArticle(vocab.word || ''),
    String(vocab.category || '').split('/')[0].trim(),
  ].map((s) => String(s || '').trim()).filter(Boolean);
  const tried = new Set();
  for (const kw of candidates) {
    if (tried.has(kw.toLowerCase())) continue;
    tried.add(kw.toLowerCase());
    let pages = [];
    try {
      pages = await searchCommons(kw);
    } catch (_) {
      continue;
    }
    const pick = pickCommonsImage(pages);
    if (!pick) continue;
    const srcUrl = pick.info.thumburl || pick.info.url;
    const res = await fetchWithTimeout(srcUrl, 60000);
    const { buffer, contentType } = await readImageBuffer(res);
    return { buffer, contentType, credit: commonsCredit(pick.info), keyword: kw, title: pick.page.title };
  }
  throw new Error('No suitable Wikimedia Commons photo found');
}

// ── Main entry points ────────────────────────────────────────────────────────

function sanitizeRecordId(recordId) {
  return String(recordId || 'vocab').replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Find (Wikimedia) or generate (Pollinations) a descriptive photo for one
 * vocab record, cache it in MinIO/S3 and persist photoUrl/photoSource in
 * DynamoDB. Handles both `vocab` and `unified-vocab` record types.
 */
async function generateAndStoreVocabPhoto(userId, record, opts = {}) {
  if (!record || !record.recordId) throw new Error('record with recordId is required');
  if (record.photoUrl && !opts.force) {
    return { skipped: true, photoUrl: record.photoUrl, record };
  }

  const vocabLike = {
    recordId: record.recordId,
    word: record.word || '',
    translation: record.translation || '',
    wordType: record.wordType || '',
    partOfSpeech: record.partOfSpeech || '',
    category: record.category || record.entryCategory || '',
  };

  const objectKey = `german/vocab/${userId}/${sanitizeRecordId(record.recordId)}_ai.jpg`;
  let buffer;
  let mimetype;
  let source;
  let credit = '';
  let detail = '';

  try {
    const wiki = await fetchWikimediaPhoto(vocabLike);
    ({ buffer, contentType: mimetype } = wiki);
    source = 'wikimedia-commons';
    credit = wiki.credit;
    detail = wiki.title;
  } catch (wikiErr) {
    const { prompt, seed, url } = previewForVocab(vocabLike);
    try {
      const res = await fetchWithTimeout(url, 90000);
      ({ buffer, contentType: mimetype } = await readImageBuffer(res));
      source = 'ai-pollinations';
      detail = prompt;
    } catch (aiErr) {
      throw new Error(`Commons lookup failed (${wikiErr.message}); AI fallback failed (${aiErr.message})`);
    }
  }

  const uploaded = await storage.uploadImage(objectKey, buffer, mimetype);
  const patch = { photoUrl: uploaded.url, photoSource: source, photoCredit: credit };

  let updated;
  if (record.type === 'unified-vocab') {
    updated = await updateUnifiedVocab(userId, record.recordId, patch);
  } else {
    updated = await updateVocab(userId, record.recordId, patch);
  }
  return { skipped: false, photoUrl: uploaded.url, photoSource: source, photoCredit: credit, detail, record: updated };
}

/**
 * Bulk photo coverage for vocab records missing one.
 */
async function autoFillVocabPhotos(userId, records, opts = {}) {
  const { force = false, limit = 50, level = null, delayMs = 1200, onProgress = null } = opts;
  let candidates = (records || []).filter(
    (r) => (r.type === 'vocab' || r.type === 'unified-vocab') && (force || !r.photoUrl)
  );
  if (level) candidates = candidates.filter((r) => (r.level || '') === level);
  candidates = candidates.slice(0, Math.max(1, limit));

  const results = [];
  let updated = 0;
  for (let i = 0; i < candidates.length; i++) {
    const rec = candidates[i];
    try {
      const out = await generateAndStoreVocabPhoto(userId, rec, { force });
      if (!out.skipped) updated++;
      results.push({ recordId: rec.recordId, word: rec.word, ok: true, skipped: !!out.skipped, photoUrl: out.photoUrl, photoSource: out.photoSource });
    } catch (err) {
      results.push({ recordId: rec.recordId, word: rec.word, ok: false, error: err.message });
    }
    if (typeof onProgress === 'function') {
      try { onProgress(i + 1, candidates.length, rec); } catch (_) {}
    }
    if (i < candidates.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return {
    processed: candidates.length,
    updated,
    skipped: results.filter((r) => r.ok && r.skipped).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

module.exports = {
  buildPhotoPrompt,
  pollinationsUrl,
  previewForVocab,
  stableSeed,
  searchKeyword,
  generateAndStoreVocabPhoto,
  autoFillVocabPhotos,
};

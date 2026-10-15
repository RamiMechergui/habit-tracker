/**
 * vocabPhoto.js
 *
 * Client-side mirror of backend/services/vocabPhoto.js:
 * builds the same AI prompt + Pollinations preview URL so the UI can show
 * what will be generated, without duplicating logic on the server round-trip.
 */

const ARTICLES = new Set(['der', 'die', 'das', 'den', 'dem', 'des']);

export function stripVocabArticle(word) {
  if (!word) return '';
  const parts = String(word).trim().split(/\s+/);
  if (parts.length > 1 && ARTICLES.has(parts[0].toLowerCase())) {
    return parts.slice(1).join(' ');
  }
  return String(word).trim();
}

export function stableSeed(str) {
  let h = 5381;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h % 1000000;
}

export function buildVocabPhotoPrompt(vocab = {}) {
  const word = stripVocabArticle(vocab.word || '');
  const translation = String(vocab.translation || '').trim() || word;
  const wordType = String(vocab.wordType || vocab.partOfSpeech || '').toLowerCase();
  const category = String(vocab.category || vocab.entryCategory || '').trim();

  let subject = `representing "${translation}"`;
  if (word) subject += ` (German: "${word}")`;
  if (wordType.includes('verb')) {
    subject += '. Show a person performing this action, dynamic simple scene';
  } else if (wordType.includes('adjective') || wordType.includes('adverb')) {
    subject += '. Visualise this quality clearly through the scene and colours';
  } else {
    subject += '. Single centered object or clear scene';
  }
  if (category && category.toLowerCase() !== 'general') subject += `, ${category} context`;
  return (
    `Simple educational language-flashcard illustration ${subject}. ` +
    `Bright flat vector style, plain light background, high contrast, ` +
    `no text, no words, no letters, no watermark`
  ).slice(0, 400);
}

export function vocabPhotoPreviewUrl(vocab = {}, width = 640, height = 400) {
  const prompt = buildVocabPhotoPrompt(vocab);
  const seed = stableSeed(`${vocab.recordId || vocab.word}|${vocab.translation}`);
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;
  return { prompt, seed, url };
}

export function vocabNeedsPhoto(v) {
  return !v?.photoUrl;
}

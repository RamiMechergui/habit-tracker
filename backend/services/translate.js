/**
 * services/translate.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Translation service for the Dialogue Builder.
 * Uses the public LibreTranslate API as the primary backend.
 * Falls back to a simulated translation when the API is unreachable.
 */

const TRANSLATE_API = 'https://libretranslate.com/translate';
const TIMEOUT_MS = 10000;

async function translateText(text, source = 'auto', target = 'de') {
  if (!text || !text.trim()) return '';

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(TRANSLATE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source, target, format: 'text' }),
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!res.ok) {
      console.warn(`[Translate] API returned ${res.status}, falling back`);
      return fallbackTranslate(text, target);
    }

    const data = await res.json();
    return data.translatedText || fallbackTranslate(text, target);
  } catch (err) {
    clearTimeout(id);
    console.warn(`[Translate] API error: ${err.message}, using fallback`);
    return fallbackTranslate(text, target);
  }
}

/**
 * Fallback translator — wraps text in brackets and appends a note.
 * In production, replace with DeepL / Google Translate integration.
 */
function fallbackTranslate(text, target) {
  if (target === 'de') {
    // Simple word-level substitution for common words (demo quality)
    const dict = {
      'hello': 'Hallo', 'hi': 'Hallo', 'good morning': 'Guten Morgen',
      'good evening': 'Guten Abend', 'how are you': 'Wie geht es Ihnen',
      'fine': 'gut', 'good': 'gut', 'thank you': 'Danke',
      'please': 'bitte', 'yes': 'ja', 'no': 'nein',
      'my name is': 'mein Name ist', 'nice to meet you': 'Freut mich',
      'what': 'was', 'where': 'wo', 'when': 'wann', 'who': 'wer',
      'how': 'wie', 'why': 'warum', 'i': 'ich', 'you': 'Sie',
      'he': 'er', 'she': 'sie', 'it': 'es', 'we': 'wir', 'they': 'sie',
      'am': 'bin', 'is': 'ist', 'are': 'sind', 'have': 'haben',
      'has': 'hat', 'do': 'mache', 'make': 'machen', 'go': 'gehen',
      'come': 'kommen', 'see': 'sehen', 'know': 'wissen', 'think': 'denken',
      'like': 'mag', 'love': 'liebe', 'can': 'kann', 'must': 'muss',
      'will': 'werde', 'would': 'würde', 'should': 'sollte',
      'and': 'und', 'but': 'aber', 'or': 'oder', 'with': 'mit',
      'in': 'in', 'on': 'auf', 'at': 'an', 'to': 'zu', 'from': 'aus',
      'a': 'ein', 'an': 'eine', 'the': 'der', 'this': 'dieser',
      'that': 'jener', 'here': 'hier', 'there': 'dort', 'now': 'jetzt',
      'today': 'heute', 'tomorrow': 'morgen', 'yesterday': 'gestern',
      'eat': 'essen', 'drink': 'trinken', 'sleep': 'schlafen',
      'read': 'lesen', 'write': 'schreiben', 'speak': 'sprechen',
      'learn': 'lernen', 'study': 'studieren', 'work': 'arbeiten',
      'play': 'spielen', 'watch': 'schauen', 'listen': 'hören',
      'book': 'Buch', 'food': 'Essen', 'water': 'Wasser',
      'house': 'Haus', 'car': 'Auto', 'friend': 'Freund',
      'family': 'Familie', 'school': 'Schule', 'university': 'Universität',
      'teacher': 'Lehrer', 'student': 'Student', 'man': 'Mann',
      'woman': 'Frau', 'child': 'Kind', 'people': 'Leute',
      'time': 'Zeit', 'day': 'Tag', 'night': 'Nacht', 'week': 'Woche',
      'month': 'Monat', 'year': 'Jahr', 'big': 'groß', 'small': 'klein',
      'new': 'neu', 'old': 'alt', 'good': 'gut', 'bad': 'schlecht',
      'beautiful': 'schön', 'important': 'wichtig', 'different': 'anders',
      'first': 'erste', 'last': 'letzte', 'next': 'nächste',
      'many': 'viele', 'some': 'einige', 'all': 'alle', 'every': 'jeder',
    };

    let result = text;
    const lower = text.toLowerCase();
    // Simple token replacement (won't handle grammar)
    const words = lower.split(/(\s+|[.,!?;:])/);
    const translated = words.map(w => {
      const clean = w.replace(/^[.,!?;:]+|[.,!?;:]+$/g, '');
      const punct = w.replace(clean, '');
      if (dict[clean]) return dict[clean] + punct;
      if (clean.endsWith('ing') && dict[clean.slice(0, -3)]) return dict[clean.slice(0, -3)] + 'e' + punct;
      if (clean.endsWith('ed') && dict[clean.slice(0, -2)]) return dict[clean.slice(0, -2)] + 'te' + punct;
      return w;
    }).join('');

    return translated;
  }
  return text;
}

module.exports = { translateText };

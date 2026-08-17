/**
 * arabicHandler.js — Arabic text detection, contextual glyph shaping & BiDi reversal
 * for client-side PDF generation via pdfmake.
 */

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Arabic glyph mapping table:
 * Character: [Isolated, Final, Initial, Medial]
 */
const ARABIC_FORMS = {
  '\u0621': ['\uFE80', '\uFE80', '\uFE80', '\uFE80'], // ء
  '\u0622': ['\uFE81', '\uFE82', '\uFE81', '\uFE82'], // آ (Right joiner)
  '\u0623': ['\uFE83', '\uFE84', '\uFE83', '\uFE84'], // أ (Right joiner)
  '\u0624': ['\uFE85', '\uFE86', '\uFE85', '\uFE86'], // ؤ (Right joiner)
  '\u0625': ['\uFE87', '\uFE88', '\uFE87', '\uFE88'], // إ (Right joiner)
  '\u0626': ['\uFE89', '\uFE8A', '\uFE8B', '\uFE8C'], // ئ
  '\u0627': ['\uFE8D', '\uFE8E', '\uFE8D', '\uFE8E'], // ا (Right joiner)
  '\u0628': ['\uFE8F', '\uFE90', '\uFE91', '\uFE92'], // ب
  '\u0629': ['\uFE93', '\uFE94', '\uFE93', '\uFE94'], // ة (Right joiner)
  '\u062A': ['\uFE95', '\uFE96', '\uFE97', '\uFE98'], // ت
  '\u062B': ['\uFE99', '\uFE9A', '\uFE9B', '\uFE9C'], // ث
  '\u062C': ['\uFE9D', '\uFE9E', '\uFE9F', '\uFEA0'], // ج
  '\u062D': ['\uFEA1', '\uFEA2', '\uFEA3', '\uFEA4'], // ح
  '\u062E': ['\uFEA5', '\uFEA6', '\uFEA7', '\uFEA8'], // خ
  '\u062F': ['\uFEA9', '\uFEAA', '\uFEA9', '\uFEAA'], // د (Right joiner)
  '\u0630': ['\uFEAB', '\uFEAC', '\uFEAB', '\uFEAC'], // ذ (Right joiner)
  '\u0631': ['\uFEAD', '\uFEAE', '\uFEAD', '\uFEAE'], // ر (Right joiner)
  '\u0632': ['\uFEAF', '\uFEB0', '\uFEAF', '\uFEB0'], // ز (Right joiner)
  '\u0633': ['\uFEB1', '\uFEB2', '\uFEB3', '\uFEB4'], // س
  '\u0634': ['\uFEB5', '\uFEB6', '\uFEB7', '\uFEB8'], // ش
  '\u0635': ['\uFEB9', '\uFEBA', '\uFEBB', '\uFEBC'], // ص
  '\u0636': ['\uFEBD', '\uFEBE', '\uFEBF', '\uFEC0'], // ض
  '\u0637': ['\uFEC1', '\uFEC2', '\uFEC3', '\uFEC4'], // ط
  '\u0638': ['\uFEC5', '\uFEC6', '\uFEC7', '\uFEC8'], // ظ
  '\u0639': ['\uFEC9', '\uFECA', '\uFECB', '\uFECC'], // ع
  '\u063A': ['\uFECD', '\uFECE', '\uFECF', '\uFED0'], // غ
  '\u0641': ['\uFED1', '\uFED2', '\uFED3', '\uFED4'], // ف
  '\u0642': ['\uFED5', '\uFED6', '\uFED7', '\uFED8'], // ق
  '\u0643': ['\uFED9', '\uFEDA', '\uFEDB', '\uFEDC'], // ك
  '\u0644': ['\uFEDD', '\uFEDE', '\uFEDF', '\uFEE0'], // ل
  '\u0645': ['\uFEE1', '\uFEE2', '\uFEE3', '\uFEE4'], // م
  '\u0646': ['\uFEE5', '\uFEE6', '\uFEE7', '\uFEE8'], // ن
  '\u0647': ['\uFEE9', '\uFEEA', '\uFEEB', '\uFEEC'], // ه
  '\u0648': ['\uFEED', '\uFEEE', '\uFEED', '\uFEEE'], // و (Right joiner)
  '\u0649': ['\uFEEF', '\uFEF0', '\uFEEF', '\uFEF0'], // ى (Right joiner)
  '\u064A': ['\uFEF1', '\uFEF2', '\uFEF3', '\uFEF4'], // ي
  '\u0671': ['\uFE8D', '\uFE8E', '\uFE8D', '\uFE8E'], // ٱ
};

// Lam-Alef ligatures
const LAM_ALEF_MAP = {
  '\u0622': ['\uFEF5', '\uFEF6'], // آ -> ﻵ / ﻶ
  '\u0623': ['\uFEF7', '\uFEF8'], // أ -> ﻷ / ﻸ
  '\u0625': ['\uFEF9', '\uFEFA'], // إ -> ﻹ / ﻺ
  '\u0627': ['\uFEFB', '\uFEFC'], // ا -> ﻻ / ﻼ
};

// Right-only joiners (cannot connect to the following letter)
const RIGHT_JOINERS = new Set([
  '\u0621', '\u0622', '\u0623', '\u0624', '\u0625', '\u0627', '\u0629',
  '\u062F', '\u0630', '\u0631', '\u0632', '\u0648', '\u0649', '\u0671'
]);

/**
 * Check if text contains any Arabic characters.
 */
export function hasArabic(text) {
  return ARABIC_REGEX.test(String(text || ''));
}

/**
 * Strip diacritics / harakat for clean shaping.
 */
function stripHarakat(str) {
  return str.replace(/[\u064B-\u0652\u0670]/g, '');
}

/**
 * Check if a character can connect to its left (preceding) neighbor.
 */
function canConnectPreceding(ch) {
  return !!ARABIC_FORMS[ch];
}

/**
 * Check if a character can connect to its right (following) neighbor.
 */
function canConnectFollowing(ch) {
  return !!ARABIC_FORMS[ch] && !RIGHT_JOINERS.has(ch);
}

/**
 * Reshape an Arabic string into positional Unicode presentation forms
 * and apply BiDi visual order reversal for pdfmake.
 */
export function reshapeArabic(text) {
  if (!text) return '';
  const clean = stripHarakat(String(text));
  if (!hasArabic(clean)) return clean;

  const chars = Array.from(clean);
  const shaped = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const prev = i > 0 ? chars[i - 1] : null;
    const next = i < chars.length - 1 ? chars[i + 1] : null;

    // Check Lam-Alef ligature
    if (ch === '\u0644' && next && LAM_ALEF_MAP[next]) {
      const prevConnects = prev && canConnectFollowing(prev);
      const ligForms = LAM_ALEF_MAP[next];
      shaped.push(prevConnects ? ligForms[1] : ligForms[0]);
      i++; // Skip the Alef
      continue;
    }

    if (!ARABIC_FORMS[ch]) {
      shaped.push(ch);
      continue;
    }

    const prevConnects = prev && canConnectFollowing(prev);
    const nextConnects = next && canConnectPreceding(next);

    const forms = ARABIC_FORMS[ch];
    let glyph = forms[0]; // Default Isolated

    if (prevConnects && nextConnects) {
      glyph = forms[3]; // Medial
    } else if (prevConnects && !nextConnects) {
      glyph = forms[1]; // Final
    } else if (!prevConnects && nextConnects) {
      glyph = forms[2]; // Initial
    } else {
      glyph = forms[0]; // Isolated
    }

    shaped.push(glyph);
  }

  // Reverse words / tokens to achieve correct RTL visual ordering in pdfmake.
  // We process contiguous Arabic runs vs non-Arabic punctuation/spaces.
  return reverseBidi(shaped.join(''));
}

/**
 * Reverse character sequence of Arabic segments so left-to-right rendering engine
 * displays them correctly right-to-left.
 */
function reverseBidi(reshapedText) {
  // Split into lines first to preserve line breaks
  const lines = reshapedText.split('\n');

  return lines.map(line => {
    // Tokenize into Arabic segments vs non-Arabic segments (numbers, symbols, spaces)
    const tokens = [];
    let currentType = null;
    let currentBuf = '';

    for (const char of line) {
      const isAr = ARABIC_REGEX.test(char) || /[\uFE70-\uFEFF\uFB50-\uFDFF]/.test(char);
      const isSpace = char === ' ' || char === '\t';

      const type = isAr ? 'ar' : isSpace ? 'space' : 'other';

      if (type === currentType || (currentType === 'ar' && isSpace)) {
        currentBuf += char;
      } else {
        if (currentBuf) tokens.push({ type: currentType, text: currentBuf });
        currentType = type;
        currentBuf = char;
      }
    }
    if (currentBuf) tokens.push({ type: currentType, text: currentBuf });

    // Reverse Arabic tokens character-by-character, and reverse order of Arabic words
    return tokens.map(t => {
      if (t.type === 'ar') {
        return Array.from(t.text).reverse().join('');
      }
      return t.text;
    }).reverse().join('');
  }).join('\n');
}

/**
 * Process a string and format it for pdfmake:
 * If it contains Arabic, reshape it and apply font: 'Amiri'.
 * Returns an array of inline runs or a formatted object.
 */
export function formatTextForPdf(text, baseStyle = {}) {
  const str = String(text || '');
  if (!str) return Object.assign({ text: '' }, baseStyle);

  if (!hasArabic(str)) {
    return Object.assign({ text: str }, baseStyle);
  }

  // Split into segments of Arabic vs Non-Arabic
  const reshaped = reshapeArabic(str);
  return Object.assign({ text: reshaped, font: 'Amiri' }, baseStyle);
}

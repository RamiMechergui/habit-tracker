/**
 * arabicHandler.js — Arabic text detection, reshaping & BiDi visual ordering
 * for client-side PDF generation via pdfmake.
 *
 * Uses:
 *   • arabic-reshaper  — contextual glyph shaping (isolated/initial/medial/final forms)
 *   • bidi-js          — Unicode BiDi algorithm for correct visual ordering
 *
 * Both are pure JS, browser-safe, and produce the Presentation Forms (FBxx/FExx)
 * that the Amiri font can render directly, even inside pdfmake which has no native
 * RTL / BiDi support.
 */

import reshaper from 'arabic-reshaper';
import bidiFactory from 'bidi-js';

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

// Lazily initialised bidi instance (stateless after creation)
let _bidi = null;
function getBidi() {
  if (!_bidi) _bidi = bidiFactory();
  return _bidi;
}

/**
 * Check if text contains any Arabic characters.
 */
export function hasArabic(text) {
  return ARABIC_REGEX.test(String(text || ''));
}

/**
 * Reshape + apply BiDi visual ordering to an Arabic-containing string.
 *
 * The report is a German-first, left-to-right document and pdfmake paints
 * text runs strictly left→right with no paragraph-direction concept, so every
 * run is ordered with a FORCED 'ltr' paragraph base — never 'auto'.
 *
 * Why not 'auto': with automatic base direction the layout flips depending on
 * which language starts the line. E.g. "قال (sagen)" (Arabic-first) was laid
 * out as an RTL paragraph → "(sagen) قال", while "Sie (التوضيح)"
 * (Latin-first) was laid out LTR. Identical box semantics produced mirrored
 * output, with parentheses detaching to the wrong side — exactly the
 * scrambled "( Sie / )" rendering seen in exported PDFs. Forcing 'ltr' keeps
 * Latin-first and pure-Arabic output byte-identical while making
 * Arabic-first mixed lines lay out German-first like everything else.
 */
export function reshapeArabic(text) {
  if (!text) return '';
  const str = String(text);
  if (!hasArabic(str)) return str;

  const bidi = getBidi();

  return str.split('\n').map(line => {
    if (!line) return line;

    // Step 1: reshape Arabic glyphs to contextual Presentation Forms
    const reshaped = reshaper.convertArabic(line);

    // Step 2: apply BiDi visual ordering with a forced LTR paragraph base
    try {
      const levels = bidi.getEmbeddingLevels(reshaped, 'ltr');
      return bidi.getReorderedString(reshaped, levels);
    } catch (_) {
      // Fallback: return the reshaped string if bidi fails
      return reshaped;
    }
  }).join('\n');
}

/**
 * Process a string and format it for pdfmake:
 * If it contains Arabic, reshape + BiDi-order it and apply font: 'Amiri'.
 */
export function formatTextForPdf(text, baseStyle = {}) {
  const str = String(text || '');
  if (!str) return Object.assign({ text: '' }, baseStyle);

  if (!hasArabic(str)) {
    return Object.assign({ text: str }, baseStyle);
  }

  const reshaped = reshapeArabic(str);
  return Object.assign({ text: reshaped, font: 'Amiri' }, baseStyle);
}

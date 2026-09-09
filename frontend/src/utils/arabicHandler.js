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
 * Strategy for mixed Arabic/Latin lines (e.g. "above all / خصوصاً"):
 *   1. Reshape the whole line with arabic-reshaper (produces contextual
 *      Presentation Forms for Arabic characters; Latin chars are left intact).
 *   2. Apply the Unicode BiDi algorithm: RTL Arabic segments are reversed
 *      into visual order; LTR Latin segments stay in place.
 *   3. Return the visually-ordered string so pdfmake paints it left→right
 *      and it reads correctly.
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

    // Step 2: apply BiDi visual ordering
    try {
      const levels = bidi.getEmbeddingLevels(reshaped);
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

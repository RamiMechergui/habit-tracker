/**
 * utils/vocabTypes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Frontend mirror of the backend vocabulary type system.
 * Provides enums, color maps, and helper functions consumed by
 * VocabularyInputBar, VocabularyCard, and related components.
 */

export const EntryCategory = Object.freeze({
  NOUN:      'Noun',
  VERB:      'Verb',
  ADJECTIVE: 'Adjective',
  ADVERB:    'Adverb',
  PHRASE:    'Phrase',
  CUSTOM:    'Custom',
  AUTO:      'Auto',
});

export const CATEGORY_ORDER = [
  EntryCategory.AUTO,
  EntryCategory.NOUN,
  EntryCategory.VERB,
  EntryCategory.ADJECTIVE,
  EntryCategory.PHRASE,
];

export const GENDER_MAP = Object.freeze({
  der: 'Masculine',
  die: 'Feminine',
  das: 'Neuter',
  Masculine: 'Masculine',
  Feminine: 'Feminine',
  Neuter: 'Neuter',
  Plural: 'Plural',
});

export const ARTICLE_TO_GENDER = Object.freeze({
  der: 'Masculine',
  die: 'Feminine',
  das: 'Neuter',
});

export const GENDER_COLORS = Object.freeze({
  Masculine: '#3b82f6',
  Feminine:  '#dc2626',
  Neuter:    '#10b981',
  Plural:    '#8b5cf6',
  der:       '#3b82f6',
  die:       '#dc2626',
  das:       '#10b981',
});

export const CATEGORY_COLORS = Object.freeze({
  [EntryCategory.NOUN]:      '#3b82f6',
  [EntryCategory.VERB]:      '#10b981',
  [EntryCategory.ADJECTIVE]: '#f97316',
  [EntryCategory.ADVERB]:    '#8b5cf6',
  [EntryCategory.PHRASE]:    '#ec4899',
  [EntryCategory.CUSTOM]:    '#6b7280',
  [EntryCategory.AUTO]:      '#eab308',
});

export const VERB_TYPE_LABELS = Object.freeze({
  regular:      'Regular',
  separable:    'Separable',
  inseparable:  'Inseparable',
  reflexive:    'Reflexive',
  irregular:    'Irregular',
});

export const REGISTER_LABELS = Object.freeze({
  Formal:   'Formal',
  Informal: 'Informal',
  Slang:    'Slang',
  Idiom:    'Idiom',
});

export const CATEGORY_ICONS = Object.freeze({
  [EntryCategory.NOUN]:      'BookA',
  [EntryCategory.VERB]:      'Zap',
  [EntryCategory.ADJECTIVE]: 'Palette',
  [EntryCategory.ADVERB]:    'ArrowRight',
  [EntryCategory.PHRASE]:    'Quote',
  [EntryCategory.CUSTOM]:    'Pencil',
  [EntryCategory.AUTO]:      'Sparkles',
});

/**
 * Detect article from a raw German input string.
 * Returns { article, word } or null if no article found.
 */
export function detectArticle(raw) {
  if (!raw) return null;
  const m = raw.trimStart().match(/^(der|die|das|den|dem|des)\s+(.+)/i);
  return m ? { article: m[1].toLowerCase(), word: m[2] } : null;
}

/**
 * Build a UiConfig from category + linguistic data (frontend mirror).
 */
export function buildUiConfig(category, lingData = {}) {
  const base = {
    cardColor: CATEGORY_COLORS[category] || CATEGORY_COLORS[EntryCategory.CUSTOM],
    badgeLabel: category,
    badgeColor: CATEGORY_COLORS[category] || '#6b7280',
    showConjugation: false,
    showDeclension: false,
    showExamples: true,
    showRegister: false,
    showAudio: true,
    showDegreeScale: false,
  };

  switch (category) {
    case EntryCategory.NOUN:
      base.badgeLabel = lingData.noun?.gender || 'Noun';
      base.badgeColor = GENDER_COLORS[lingData.noun?.article] || GENDER_COLORS[lingData.noun?.gender] || CATEGORY_COLORS[EntryCategory.NOUN];
      base.showDeclension = true;
      break;
    case EntryCategory.VERB:
      base.badgeLabel = VERB_TYPE_LABELS[lingData.verb?.verbType] || 'Verb';
      base.showConjugation = true;
      break;
    case EntryCategory.ADJECTIVE:
      base.badgeLabel = 'Adjective';
      base.showDegreeScale = true;
      break;
    case EntryCategory.PHRASE:
      base.badgeLabel = REGISTER_LABELS[lingData.phrase?.register] || 'Phrase';
      base.showRegister = true;
      break;
    default:
      break;
  }

  return base;
}

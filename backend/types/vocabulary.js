/**
 * types/vocabulary.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Core data models, enums, and schema definitions for the unified vocabulary
 * processing system. Every incoming request and outgoing response conforms to
 * these shapes — no implicit fields, no ad-hoc objects.
 *
 * Entry Categories
 *   'Noun' | 'Verb' | 'Adjective' | 'Adverb' | 'Phrase' | 'Custom' | 'Auto'
 *
 * Unified Schema
 *   entryMetadata → linguisticData → uiConfig
 */

// ── 1. Category Enum ─────────────────────────────────────────────────────────

/** @readonly @enum {string} */
const EntryCategory = Object.freeze({
  NOUN:      'Noun',
  VERB:      'Verb',
  ADJECTIVE: 'Adjective',
  ADVERB:    'Adverb',
  PHRASE:    'Phrase',
  CUSTOM:    'Custom',
  AUTO:      'Auto',
});

/** Ordered list used by the segmented control UI pills */
const CATEGORY_ORDER = [
  EntryCategory.AUTO,
  EntryCategory.NOUN,
  EntryCategory.VERB,
  EntryCategory.ADJECTIVE,
  EntryCategory.PHRASE,
];

// ── 2. Gender & Article Helpers (German-specific) ────────────────────────────

/** @readonly @enum {string} */
const Gender = Object.freeze({
  MASCULINE: 'Masculine',
  FEMININE:  'Feminine',
  NEUTER:    'Neuter',
  PLURAL:    'Plural',
});

/** @readonly @enum {string} */
const Article = Object.freeze({
  DER: 'der',
  DIE: 'die',
  DAS: 'das',
  NONE: '',
});

/** Maps article → gender for quick lookup */
const ARTICLE_TO_GENDER = Object.freeze({
  [Article.DER]: Gender.MASCULINE,
  [Article.DIE]: Gender.FEMININE,
  [Article.DAS]: Gender.NEUTER,
});

const GENDER_COLORS = Object.freeze({
  [Gender.MASCULINE]: '#3b82f6',
  [Gender.FEMININE]:  '#dc2626',
  [Gender.NEUTER]:    '#10b981',
  [Gender.PLURAL]:    '#8b5cf6',
  [Article.DER]:      '#3b82f6',
  [Article.DIE]:      '#dc2626',
  [Article.DAS]:      '#10b981',
});

// ── 3. Verb-Specific Enums ───────────────────────────────────────────────────

/** @readonly @enum {string} */
const VerbType = Object.freeze({
  REGULAR:      'regular',
  SEPARABLE:    'separable',
  INSEPARABLE:  'inseparable',
  REFLEXIVE:    'reflexive',
  IRREGULAR:    'irregular',
});

/** @readonly @enum {string} */
const GoverningCase = Object.freeze({
  ACCUSATIVE: 'Accusative',
  DATIVE:     'Dative',
  GENITIVE:   'Genitive',
  TWO_WAY:    'Two-way',
});

// ── 4. Phrase Register ───────────────────────────────────────────────────────

/** @readonly @enum {string} */
const Register = Object.freeze({
  FORMAL: 'Formal',
  INFORMAL: 'Informal',
  SLANG: 'Slang',
  IDIOM: 'Idiom',
});

// ── 5. Category Badge Colors (card header) ───────────────────────────────────

const CATEGORY_COLORS = Object.freeze({
  [EntryCategory.NOUN]:      '#3b82f6',
  [EntryCategory.VERB]:      '#10b981',
  [EntryCategory.ADJECTIVE]: '#f97316',
  [EntryCategory.ADVERB]:    '#8b5cf6',
  [EntryCategory.PHRASE]:    '#ec4899',
  [EntryCategory.CUSTOM]:    '#6b7280',
  [EntryCategory.AUTO]:      '#eab308',
});

// ── 6. Incoming Request Schemas (validation contracts) ───────────────────────

/**
 * @typedef {Object} VocabProcessRequest
 * @property {string}  rawInput      - The user's raw text (word/phrase/sentence)
 * @property {string}  category      - One of EntryCategory values (or 'Auto')
 * @property {string}  [targetLang]  - Target language code (default: 'de')
 * @property {string}  [sourceLang]  - Source language code (default: 'en')
 * @property {string}  [level]       - CEFR level override (e.g. 'A1.1')
 * @property {Object}  [hints]       - Optional manual overrides from contextual aux fields
 * @property {string}  [hints.article]      - Manual article override (noun)
 * @property {string}  [hints.gender]       - Manual gender override (noun)
 * @property {string}  [hints.baseForm]     - Manual base form override (verb)
 * @property {string}  [hints.preposition]  - Manual preposition override (verb)
 */

/** JSON-Schema-style validation descriptor (used by the route layer) */
const REQUEST_SCHEMA = Object.freeze({
  required: ['rawInput'],
  properties: {
    rawInput:    { type: 'string', minLength: 1, maxLength: 500 },
    category:    { type: 'string', enum: Object.values(EntryCategory) },
    targetLang:  { type: 'string', default: 'de' },
    sourceLang:  { type: 'string', default: 'en' },
    level:       { type: 'string', pattern: /^[ABC][12]\.[12]$/ },
    hints: {
      type: 'object',
      properties: {
        article:      { type: 'string', enum: Object.values(Article) },
        gender:       { type: 'string', enum: Object.values(Gender) },
        baseForm:     { type: 'string' },
        preposition:  { type: 'string' },
      },
    },
  },
});

// ── 7. Linguistic Data Payloads (per-category) ───────────────────────────────

/**
 * @typedef {Object} NounAttributes
 * @property {string} [gender]         - 'Masculine' | 'Feminine' | 'Neuter' | 'Plural'
 * @property {string} [article]        - 'der' | 'die' | 'das' | ''
 * @property {string} [pluralForm]     - e.g. 'Tische', '-e', 'strong/irregular'
 * @property {string} [declensionGroup]- e.g. 'masculine weak', 'mixed', 'strong'
 */

/**
 * @typedef {Object} VerbAttributes
 * @property {string} [verbType]          - 'regular' | 'separable' | 'inseparable' | 'reflexive' | 'irregular'
 * @property {string} [infinitive]        - Full infinitive form
 * @property {string} [pastTense]         - Präteritum (er/sie/es form)
 * @property {string} [pastParticiple]    - Partizip II
 * @property {string} [governingCase]     - 'Accusative' | 'Dative' | 'Genitive' | 'Two-way'
 * @property {string} [preposition]       - Governing preposition (if applicable)
 * @property {Object} [conjugation]       - Full present-tense conjugation map
 * @property {boolean} [separable]        - Whether the verb separates
 * @property {string}  [separablePrefix]  - The separable prefix (if any)
 * @property {string}  [auxiliary]         - 'haben' | 'sein'
 */

/**
 * @typedef {Object} AdjectiveAttributes
 * @property {string} [comparative]  - Comparative form (e.g. 'größer')
 * @property {string} [superlative]  - Superlative form (e.g. 'am größten')
 * @property {string[]} [antonyms]   - Antonym words
 * @property {string[]} [synonyms]   - Synonym words
 */

/**
 * @typedef {Object} PhraseAttributes
 * @property {string} [literalTranslation] - Word-for-word translation
 * @property {string} [register]           - 'Formal' | 'Informal' | 'Slang' | 'Idiom'
 * @property {string} [usage]             - Context/usage notes
 */

// ── 8. Unified Output Schema ─────────────────────────────────────────────────

/**
 * @typedef {Object} EntryMetadata
 * @property {string} entryId          - Unique identifier (VOCAB#<uuid>)
 * @property {string} category         - One of EntryCategory
 * @property {string} word             - The target-language word/phrase
 * @property {string} translation      - Source-language translation
 * @property {string} [level]          - CEFR level
 * @property {string} [targetLang]     - Target language code
 * @property {string} [sourceLang]     - Source language code
 * @property {string} createdAt        - ISO 8601 timestamp
 */

/**
 * @typedef {Object} LinguisticData
 * @property {NounAttributes}      [noun]
 * @property {VerbAttributes}      [verb]
 * @property {AdjectiveAttributes} [adjective]
 * @property {PhraseAttributes}    [phrase]
 * @property {string}  [phonetic]          - IPA / pronunciation guide
 * @property {string}  [example]           - Example sentence in target language
 * @property {string}  [exampleTranslation]- Translation of the example
 * @property {string[]} [tags]             - Semantic tags
 * @property {string}  [partOfSpeech]      - Expanded POS label
 */

/**
 * @typedef {Object} UiConfig
 * @property {string}  cardColor         - Hex color for the card header
 * @property {string}  badgeLabel        - Short badge text (e.g. 'Maskulinum')
 * @property {string}  badgeColor        - Hex color for the badge
 * @property {boolean} showConjugation   - Render conjugation table widget
 * @property {boolean} showDeclension    - Render declension widget
 * @property {boolean} showExamples      - Render example sentence widget
 * @property {boolean} showRegister      - Render register/context badge
 * @property {boolean} showAudio         - Render audio pronunciation trigger
 * @property {boolean} showDegreeScale   - Render base → comparative → superlative
 * @property {string}  [degreeBase]      - Base form for degree scale
 * @property {string}  [degreeComparative]
 * @property {string}  [degreeSuperlative]
 */

/**
 * @typedef {Object} VocabProcessResponse
 * @property {EntryMetadata}  entryMetadata
 * @property {LinguisticData} linguisticData
 * @property {UiConfig}       uiConfig
 */

// ── 9. UI Config Builder ─────────────────────────────────────────────────────

/**
 * Builds the UiConfig from category + linguisticData.
 * @param {string} category
 * @param {LinguisticData} lingData
 * @returns {UiConfig}
 */
function buildUiConfig(category, lingData) {
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
      base.badgeLabel = lingData?.noun?.gender || 'Noun';
      base.badgeColor = GENDER_COLORS[lingData?.noun?.article] || GENDER_COLORS[lingData?.noun?.gender] || CATEGORY_COLORS[EntryCategory.NOUN];
      base.showDeclension = true;
      break;

    case EntryCategory.VERB:
      base.badgeLabel = lingData?.verb?.verbType || 'Verb';
      base.showConjugation = true;
      break;

    case EntryCategory.ADJECTIVE:
      base.badgeLabel = 'Adjective';
      base.showDegreeScale = true;
      break;

    case EntryCategory.PHRASE:
      base.badgeLabel = lingData?.phrase?.register || 'Phrase';
      base.showRegister = true;
      break;

    case EntryCategory.ADVERB:
      base.badgeLabel = 'Adverb';
      break;

    default:
      break;
  }

  return base;
}

module.exports = {
  EntryCategory,
  CATEGORY_ORDER,
  Gender,
  Article,
  ARTICLE_TO_GENDER,
  GENDER_COLORS,
  VerbType,
  GoverningCase,
  Register,
  CATEGORY_COLORS,
  REQUEST_SCHEMA,
  buildUiConfig,
};

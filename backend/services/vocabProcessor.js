/**
 * services/vocabProcessor.js
 * ─────────────────────────────────────────────────────────────────────────────
 * LLM Processing Engine — converts raw user input into the unified
 * VocabularyCard schema via OpenAI structured output.
 *
 * Pipeline:
 *   1. Pre-classify category (if not Auto)
 *   2. Build system prompt with JSON-schema enforcement
 *   3. Call LLM (temperature 0.2, json_object response)
 *   4. Parse + validate response
 *   5. Merge user-provided hints
 *   6. Return VocabProcessResponse
 */

const OpenAI = require('openai');
const { EntryCategory, buildUiConfig } = require('../types/vocabulary');

let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert multilingual linguist and vocabulary data engineer.
Your job is to analyze a raw word or phrase and produce a structured JSON vocabulary card.

RULES:
1. Detect the target language automatically. Common cues: German articles (der/die/das), verb endings (-en, -ieren), adjective endings (-er, -lich).
2. Detect the source language from context.
3. Classify the entry into exactly ONE category: "Noun", "Verb", "Adjective", "Adverb", "Phrase", or "Custom".
4. Fill in ALL relevant fields for that category. Leave irrelevant category blocks as null.
5. Generate a natural example sentence in the target language with English translation.
6. Provide IPA phonetic transcription.
7. Generate 2-3 semantic tags.
8. If the input contains a separable verb prefix (e.g., "anfangen"), set separable=true and separatePrefix="an".

OUTPUT SCHEMA (strict JSON — no markdown, no explanation):
{
  "category": "Noun" | "Verb" | "Adjective" | "Adverb" | "Phrase" | "Custom",
  "word": "<target-language word>",
  "translation": "<source-language translation>",
  "phonetic": "<IPA phonetic>",
  "noun": {
    "gender": "Masculine" | "Feminine" | "Neuter" | "Plural" | null,
    "article": "der" | "die" | "das" | "" | null,
    "pluralForm": "<plural form or rule>" | null,
    "declensionGroup": "<declension group>" | null
  },
  "verb": {
    "verbType": "regular" | "separable" | "inseparable" | "reflexive" | "irregular" | null,
    "infinitive": "<full infinitive>" | null,
    "pastTense": "<präteritum form>" | null,
    "pastParticiple": "<partizip II>" | null,
    "governingCase": "Accusative" | "Dative" | "Genitive" | "Two-way" | null,
    "preposition": "<governing preposition>" | null,
    "conjugation": {
      "ich": "...", "du": "...", "er_sie_es": "...",
      "wir": "...", "ihr": "...", "Sie": "..."
    } | null,
    "separable": true | false | null,
    "separablePrefix": "<prefix>" | null,
    "auxiliary": "haben" | "sein" | null
  },
  "adjective": {
    "comparative": "<comparative form>" | null,
    "superlative": "<superlative form>" | null,
    "antonyms": ["<antonym1>", ...] | null,
    "synonyms": ["<synonym1>", ...] | null
  },
  "phrase": {
    "literalTranslation": "<word-for-word translation>" | null,
    "register": "Formal" | "Informal" | "Slang" | "Idiom" | null,
    "usage": "<usage context note>" | null
  },
  "example": "<target-language example sentence>",
  "exampleTranslation": "<English translation of example>",
  "tags": ["<tag1>", "<tag2>"],
  "partOfSpeech": "<expanded POS label>"
}`;

// ── Response Validator ────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['category', 'word', 'translation', 'example', 'exampleTranslation'];

function validateAndNormalize(parsed, userHints) {
  const errors = [];
  for (const f of REQUIRED_FIELDS) {
    if (!parsed[f]) errors.push(`Missing required field: ${f}`);
  }
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }

  const category = Object.values(EntryCategory).includes(parsed.category)
    ? parsed.category
    : EntryCategory.CUSTOM;

  const result = {
    entryMetadata: {
      entryId: '',
      category,
      word: String(parsed.word).trim(),
      translation: String(parsed.translation).trim(),
      level: null,
      targetLang: null,
      sourceLang: null,
      createdAt: new Date().toISOString(),
    },
    linguisticData: {
      noun: category === EntryCategory.NOUN ? {
        gender: userHints.gender || parsed.noun?.gender || null,
        article: userHints.article || parsed.noun?.article || '',
        pluralForm: parsed.noun?.pluralForm || null,
        declensionGroup: parsed.noun?.declensionGroup || null,
      } : null,
      verb: category === EntryCategory.VERB ? {
        verbType: parsed.verb?.verbType || null,
        infinitive: userHints.baseForm || parsed.verb?.infinitive || parsed.word,
        pastTense: parsed.verb?.pastTense || null,
        pastParticiple: parsed.verb?.pastParticiple || null,
        governingCase: parsed.verb?.governingCase || null,
        preposition: userHints.preposition || parsed.verb?.preposition || null,
        conjugation: parsed.verb?.conjugation || null,
        separable: parsed.verb?.separable || false,
        separablePrefix: parsed.verb?.separablePrefix || null,
        auxiliary: parsed.verb?.auxiliary || null,
      } : null,
      adjective: category === EntryCategory.ADJECTIVE ? {
        comparative: parsed.adjective?.comparative || null,
        superlative: parsed.adjective?.superlative || null,
        antonyms: parsed.adjective?.antonyms || [],
        synonyms: parsed.adjective?.synonyms || [],
      } : null,
      phrase: category === EntryCategory.PHRASE ? {
        literalTranslation: parsed.phrase?.literalTranslation || null,
        register: parsed.phrase?.register || null,
        usage: parsed.phrase?.usage || null,
      } : null,
      phonetic: parsed.phonetic || null,
      example: parsed.example || '',
      exampleTranslation: parsed.exampleTranslation || '',
      tags: parsed.tags || [],
      partOfSpeech: parsed.partOfSpeech || category,
    },
    uiConfig: null,
  };

  result.uiConfig = buildUiConfig(category, result.linguisticData);

  return result;
}

// ── Main Processor ────────────────────────────────────────────────────────────

/**
 * Process a raw vocabulary input through the LLM pipeline.
 *
 * @param {Object} request
 * @param {string} request.rawInput
 * @param {string} [request.category='Auto']
 * @param {Object} [request.hints={}]
 * @param {string} [request.targetLang='de']
 * @param {string} [request.sourceLang='en']
 * @param {string} [request.level]
 * @returns {Promise<Object>} VocabProcessResponse
 */
async function processVocab({ rawInput, category = EntryCategory.AUTO, hints = {}, targetLang = 'de', sourceLang = 'en', level }) {
  if (!openai) {
    throw new Error('OpenAI API key is not configured on the server.');
  }

  if (!rawInput || !rawInput.trim()) {
    throw new Error('rawInput is required and cannot be empty.');
  }

  const targetLangNames = { de: 'German', en: 'English', fr: 'French', es: 'Spanish', it: 'Italian', pt: 'Portuguese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ar: 'Arabic', ru: 'Russian', tr: 'Turkish' };
  const targetName = targetLangNames[targetLang] || targetLang;
  const sourceName = targetLangNames[sourceLang] || sourceLang;

  let classificationInstruction = '';
  if (category !== EntryCategory.AUTO) {
    classificationInstruction = `\nThe user has pre-classified this entry as "${category}". If this is clearly wrong (e.g., the input is obviously a verb but was labeled "Noun"), you may override it — but prefer the user's classification when reasonable.`;
  }

  let hintsInstruction = '';
  if (hints.article) {
    hintsInstruction += `\nThe user specified the article as "${hints.article}". Use this.`;
  }
  if (hints.gender) {
    hintsInstruction += `\nThe user specified the gender as "${hints.gender}". Use this.`;
  }
  if (hints.baseForm) {
    hintsInstruction += `\nThe user specified the base/infinitive form as "${hints.baseForm}". Use this.`;
  }
  if (hints.preposition) {
    hintsInstruction += `\nThe user specified the governing preposition as "${hints.preposition}". Use this.`;
  }

  const userMessage = `Analyze and structure the following vocabulary entry.
Target language: ${targetName} (${targetLang})
Source language: ${sourceName} (${sourceLang})
${level ? `CEFR Level: ${level}` : ''}
${classificationInstruction}${hintsInstruction}

Input: "${rawInput}"

Return ONLY valid JSON matching the schema. No markdown fences, no explanation.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    max_tokens: 800,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty response.');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (parseErr) {
    throw new Error(`LLM response was not valid JSON: ${parseErr.message}`);
  }

  const result = validateAndNormalize(parsed, hints);
  result.entryMetadata.targetLang = targetLang;
  result.entryMetadata.sourceLang = sourceLang;
  if (level) result.entryMetadata.level = level;

  return result;
}

module.exports = { processVocab };

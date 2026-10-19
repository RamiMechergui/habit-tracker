const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { protect } = require('../middleware/auth');

// Initialize OpenAI conditionally
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

router.use(protect);

router.post('/explain-grammar', async (req, res) => {
  try {
    const { sentence, targetPhrase } = req.body;
    
    if (!openai) {
      return res.status(503).json({ message: 'OpenAI API key is not configured on the server.' });
    }

    if (!sentence) {
      return res.status(400).json({ message: 'Sentence is required' });
    }

    const prompt = `You are a helpful and encouraging German language tutor. 
    Explain the grammar in the following German sentence in simple terms.
    If a target phrase is provided, focus the explanation specifically on that phrase.
    
    Sentence: "${sentence}"
    Target Phrase: "${targetPhrase || 'N/A'}"
    
    Format your response in a clean, easily readable way. Use markdown.
    Include:
    1. A simple English translation.
    2. The core grammar rule being used (cases, verb position, tense, etc).
    3. One more similar example sentence to help them understand.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using the fast/cheap model by default
      messages: [
        { role: "system", content: "You are an expert German language tutor." },
        { role: "user", content: prompt }
      ],
      max_tokens: 400,
    });

    res.json({ explanation: completion.choices[0].message.content });
  } catch (err) {
    console.error('[AI] Explain grammar error:', err);
    res.status(500).json({ message: 'Failed to generate explanation', error: err.message });
  }
});

router.post('/correct-writing', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!openai) {
      return res.status(503).json({ message: 'OpenAI API key is not configured on the server.' });
    }

    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }

    const prompt = `You are a strict but encouraging German language tutor.
    The user has written a text in German. Please correct it.
    
    User Text:
    "${text}"
    
    Please provide your response in the following JSON format:
    {
      "correctedText": "The fully corrected text here",
      "corrections": [
        {
          "original": "the wrong word/phrase",
          "correction": "the correct word/phrase",
          "explanation": "Brief explanation of why it was wrong"
        }
      ],
      "overallFeedback": "A short, encouraging 2-sentence summary of how they did and what to focus on."
    }
    
    Ensure your response is valid JSON.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an expert German language tutor. You must reply strictly in valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const result = JSON.parse(completion.choices[0].message.content);
    res.json(result);
  } catch (err) {
    console.error('[AI] Correct writing error:', err);
    res.status(500).json({ message: 'Failed to correct writing', error: err.message });
  }
});

// ── POST /api/ai/classify-vocab ───────────────────────────────────────────────
// Classifies vocabulary words into "menu" (theme) titles. Existing menu titles
// are sent along so the model REUSES them whenever one fits and only invents a
// new title when none of them works — the client then creates the missing menus.
router.post('/classify-vocab', async (req, res) => {
  try {
    const { words, existingMenus } = req.body;

    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ message: 'words array is required' });
    }
    if (!openai) {
      return res.status(503).json({ message: 'OpenAI API key is not configured on the server.' });
    }

    // Keep the payload compact — recordId doubles as the assignment key.
    const clean = words.slice(0, 500).map((w, i) => ({
      id: w.recordId || String(i),
      w: w.word || '',
      a: w.article || '',
      t: w.translation || '',
      c: w.category || '',
      p: w.wordType || w.partOfSpeech || '',
    }));
    const menus = (Array.isArray(existingMenus) ? existingMenus : []).slice(0, 200);

    const prompt = `Classify each German vocabulary word below into ONE theme menu (a short topic group).
Existing menus — reuse one EXACTLY (same characters) whenever it fits: ${menus.length ? JSON.stringify(menus) : 'none yet'}.

Words (JSON array): ${JSON.stringify(clean)}

Rules:
- Reply with ONE JSON object shaped like { "assignments": { "<id>": "<Menu Title>" } } covering EVERY word id.
- Reuse an existing menu title whenever one fits; only invent a new short Title Case menu title (2-4 words, e.g. "Food & Drink") when none fits.
- Words about the same theme must share the same menu title.
- Use the category hint (field "c") when it is meaningful.
- No markdown, no extra keys, valid JSON only.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a German language curriculum assistant. You must reply strictly in valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });

    const parsed = JSON.parse(completion.choices[0].message.content || "{}");
    const assignments = parsed && typeof parsed.assignments === "object" && parsed.assignments ? parsed.assignments : {};

    res.json({
      assignments,
      total: clean.length,
      returned: Object.keys(assignments).length,
    });
  } catch (err) {
    console.error('[AI] Classify vocab error:', err);
    res.status(500).json({ message: 'Failed to classify vocabulary', error: err.message });
  }
});

module.exports = router;

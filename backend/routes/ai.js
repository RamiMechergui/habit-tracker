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

module.exports = router;

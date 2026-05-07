const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TASTE_FILE = path.join(__dirname, '../user/taste.md');
const HISTORY_FILE = path.join(__dirname, '../user/playlists.json');
const PERSONA_FILE = path.join(__dirname, '../prompts/dj-persona.md');

async function getDJResponse(userInput = null) {
  const taste = fs.readFileSync(TASTE_FILE, 'utf8');
  const history = fs.readFileSync(HISTORY_FILE, 'utf8');
  const persona = fs.readFileSync(PERSONA_FILE, 'utf8');
  
  const systemPrompt = `You are Claudio, the AI DJ. 
Analyze the provided context (time, weather, taste, history) and the user's input.
Your goal is to act as a professional, vibe-setting DJ.
Your speech should be natural and engaging. 

You MUST respond with a valid JSON object. 
Format:
{
  "say": "Speech to introduce the music. Be descriptive and human-like.",
  "play": ["Song Title - Artist", "Song Title - Artist"],
  "intent": "interrupt" | "append",
  "reason": "Internal reasoning for these picks",
  "segue": "Smooth transition text"
}
Note: 
- Use "interrupt" if the user mentions "something else", "change", "stop", "play X", or any request that implies switching from what is currently playing. 
- Use "append" ONLY for automatic scheduled updates or if the user explicitly says "add to queue".`;

  const context = `
CURRENT TIME: ${new Date().toLocaleTimeString()}
CITY: ${process.env.CITY || 'Casablanca'}
USER TASTE: ${taste}
PLAY HISTORY: ${history}
PERSONA GUIDELINES: ${persona}
`;

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Context: ${context}\n\nUser Message: ${userInput || 'Give me a routine set for now.'}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return JSON.parse(response.data.choices[0].message.content);
  } catch (err) {
    console.error('Groq AI Error:', err.response?.data || err.message);
    // Return a safe fallback if AI fails
    return {
      say: "Hey there! I'm having a little trouble thinking right now, but let's keep the music moving.",
      play: ["Blinding Lights - The Weeknd"],
      intent: "append",
      reason: "API Fallback",
      segue: "Back to the hits."
    };
  }
}

module.exports = { getDJResponse };

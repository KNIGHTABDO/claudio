const fs = require('fs');
const path = require('path');
const axios = require('axios');
const db = require('./db');
require('dotenv').config();

async function buildContext(userInput) {
  const readDoc = (file) => fs.readFileSync(path.resolve(__dirname, `../user/${file}`), 'utf-8');
  
  const taste = readDoc('taste.md');
  const routines = readDoc('routines.md');
  const moodRules = readDoc('mood-rules.md');
  const persona = fs.readFileSync(path.resolve(__dirname, '../prompts/dj-persona.md'), 'utf-8');
  
  const recentPlays = await db.getRecentPlays(5);
  const playHistory = recentPlays.map(p => `${p.song_name} - ${p.artist}`).join(', ');

  // Fetch Weather
  let weather = 'Unknown';
  try {
    const weatherRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${process.env.CITY || 'Casablanca'}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`
    );
    weather = `${weatherRes.data.weather[0].description}, ${weatherRes.data.main.temp}°C`;
  } catch (err) {
    console.warn('Weather fetch failed, using default.');
  }

  return `
[SYSTEM PERSONA]
${persona}

[USER TASTE]
${taste}

[USER ROUTINES]
${routines}

[MOOD RULES]
${moodRules}

[ENVIRONMENT]
Time: ${new Date().toLocaleString()}
Weather: ${weather}

[MEMORY RECALL]
Recently played: ${playHistory || 'Nothing yet'}

[USER INPUT]
${userInput || 'The radio is starting up. Introduce yourself and play something that fits the current vibe.'}
`;
}

module.exports = { buildContext };

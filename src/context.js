const fs = require('fs');
const path = require('path');
const axios = require('axios');
const db = require('./db');
require('dotenv').config();

async function getContextData() {
  const readDoc = (file) => fs.readFileSync(path.resolve(__dirname, `../user/${file}`), 'utf-8');
  
  const taste = readDoc('taste.md');
  const routines = readDoc('routines.md');
  const moodRules = readDoc('mood-rules.md');
  const persona = fs.readFileSync(path.resolve(__dirname, '../prompts/dj-persona.md'), 'utf-8');
  
  const recentPlays = await db.getRecentPlays(10);
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

  // Load playlists.json as favorites
  let favorites = '';
  try {
    const favoritesPath = path.resolve(__dirname, '../user/playlists.json');
    if (fs.existsSync(favoritesPath)) {
      const favList = JSON.parse(fs.readFileSync(favoritesPath, 'utf-8'));
      favorites = favList.map(f => `- ${f.name} - ${f.artist}`).join('\n');
    }
  } catch (err) {
    console.warn('Failed to load user playlists.json:', err.message);
  }

  return {
    taste,
    routines,
    moodRules,
    persona,
    weather,
    playHistory,
    favorites,
    currentTime: new Date().toLocaleTimeString()
  };
}

async function buildContext(userInput) {
  const data = await getContextData();

  return `
[SYSTEM PERSONA]
${data.persona}

[USER TASTE]
${data.taste}

[USER ROUTINES]
${data.routines}

[MOOD RULES]
${data.moodRules}

[ENVIRONMENT]
Time: ${new Date().toLocaleString()}
Weather: ${data.weather}

[MEMORY RECALL]
Recently played: ${data.playHistory || 'Nothing yet'}
Favorites:
${data.favorites}

[USER INPUT]
${userInput || 'The radio is starting up. Introduce yourself and play something that fits the current vibe.'}
`;
}

module.exports = { buildContext, getContextData };


const fs = require('fs');
const path = require('path');
const axios = require('axios');
const db = require('./db');
require('dotenv').config();

async function getContextData() {
  const readDoc = (file, fallback = '') => {
    const filePath = path.resolve(__dirname, `../user/${file}`);
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      if (err.code === 'ENOENT') return fallback;
      throw err;
    }
  };

  const taste = readDoc('taste.md', 'No explicit taste profile yet. Infer carefully from favorites, play history, and direct user requests.');
  const routines = readDoc('routines.md');
  const moodRules = readDoc('mood-rules.md');
  const persona = fs.readFileSync(path.resolve(__dirname, '../prompts/dj-persona.md'), 'utf-8');

  const recentPlays = await db.getRecentPlays(10);
  const playHistory = recentPlays.map(p => `${p.song_name} - ${p.artist}`).join(', ');

  let weather = 'Unknown';
  try {
    const weatherRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${process.env.CITY || 'Casablanca'}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`,
      { timeout: 8000 }
    );
    weather = `${weatherRes.data.weather[0].description}, ${weatherRes.data.main.temp}°C`;
  } catch {
    console.warn('Weather fetch failed, using default.');
  }

  let favorites = '';
  try {
    const favoritesPath = path.resolve(__dirname, '../user/playlists.json');
    if (fs.existsSync(favoritesPath)) {
      const favList = JSON.parse(fs.readFileSync(favoritesPath, 'utf-8'));
      favorites = favList.map(f => `- ${f.name} - ${f.artist}`).join('\n');
    }
  } catch (err) {
    console.warn('Failed to load playlists.json:', err.message);
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

module.exports = { getContextData };

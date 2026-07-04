const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const TTS_CACHE_DIR = path.resolve(__dirname, '../public/tts');

if (!fs.existsSync(TTS_CACHE_DIR)) {
  fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
}

async function generateSpeech(text) {
  const cleanText = text.replace(/\[.*?\]/g, '').trim();
  if (!cleanText) return null;

  const hash = crypto.createHash('md5').update(cleanText).digest('hex');
  const fileName = `${hash}.mp3`;
  const filePath = path.join(TTS_CACHE_DIR, fileName);
  const publicPath = `/tts/${fileName}`;

  if (fs.existsSync(filePath)) return publicPath;

  const response = await axios.post(
    'https://api.deepgram.com/v1/speak?model=aura-asteria-en',
    { text: cleanText },
    {
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream'
    }
  );

  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(publicPath));
    writer.on('error', reject);
  });
}

function cleanupTTS() {
  try {
    const files = fs.readdirSync(TTS_CACHE_DIR);
    const now = Date.now();
    const EXPIRATION_MS = 10 * 60 * 1000;

    files.forEach(file => {
      const filePath = path.join(TTS_CACHE_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > EXPIRATION_MS) fs.unlinkSync(filePath);
    });
  } catch {}
}

module.exports = { generateSpeech, cleanupTTS };

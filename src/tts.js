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
  // Deepgram doesn't support tags, so we should be sending clean text.
  // We'll strip brackets just in case the model still includes them.
  const cleanText = text.replace(/\[.*?\]/g, '').trim();
  
  const hash = crypto.createHash('md5').update(cleanText).digest('hex');
  const fileName = `${hash}.mp3`;
  const filePath = path.join(TTS_CACHE_DIR, fileName);
  const publicPath = `/tts/${fileName}`;

  if (fs.existsSync(filePath)) {
    console.log(`TTS Cache Hit: ${cleanText.substring(0, 20)}...`);
    return publicPath;
  }

  console.log(`TTS Cache Miss: Generating Deepgram Aura speech for "${cleanText.substring(0, 20)}..."`);

  try {
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
  } catch (error) {
    console.error('Deepgram TTS Error:', error.response?.data || error.message);
    throw error;
  }
}

async function cleanupTTS() {
  const files = fs.readdirSync(TTS_CACHE_DIR);
  const now = Date.now();
  const EXPIRATION_MS = 3 * 60 * 1000; // 3 minutes

  files.forEach(file => {
    const filePath = path.join(TTS_CACHE_DIR, file);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs > EXPIRATION_MS) {
      console.log(`[Janitor] Deleting expired transmission: ${file}`);
      fs.unlinkSync(filePath);
    }
  });
}

module.exports = { generateSpeech, cleanupTTS };


const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { pipeline } = require('stream');
const { handleIntent } = require('./src/router');
const { initScheduler } = require('./src/scheduler');
const { cleanupTTS } = require('./src/tts');
require('dotenv').config();


const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/stream' });

// WebSocket Logic
wss.on('connection', (ws) => {
  console.log('New listener connected.');
  
  ws.on('message', async (msgStr) => {
    try {
      const msg = JSON.parse(msgStr);
      if (msg.type === 'INIT_SESSION') {
        if (!msg.resume) {
          console.log('[Session] New session init requested. Triggering startup curation...');
          const result = await handleIntent(null);
          ws.send(JSON.stringify({ type: 'DJ_ROUTINE', ...result }));
        } else {
          console.log('[Session] Resuming existing session. Skipping startup curation.');
        }
      }
    } catch (err) {
      console.error('[WebSocket Message Error]', err);
    }
  });
});

function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}


// Initialize Scheduler & Janitor
initScheduler(broadcast);
setInterval(cleanupTTS, 60 * 1000); // Run every minute


// API Endpoints
app.get('/api/status', (req, res) => {
  res.json({ status: 'ON AIR', time: new Date().toLocaleTimeString() });
});

app.get('/api/history', async (req, res) => {
  try {
    const db = require('./src/db');
    const crypto = require('crypto');
    const messages = await db.getRecentMessages(15);
    
    const mappedMessages = messages.map(msg => {
      if (msg.role === 'claudio') {
        const cleanText = msg.content.replace(/\[.*?\]/g, '').trim();
        const hash = crypto.createHash('md5').update(cleanText).digest('hex');
        const ttsFileName = `${hash}.mp3`;
        const ttsFilePath = path.join(__dirname, 'public/tts', ttsFileName);
        const hasTts = fs.existsSync(ttsFilePath);
        return {
          role: 'claudio',
          content: msg.content,
          ttsUrl: hasTts ? `/tts/${ttsFileName}` : null
        };
      }
      return {
        role: 'user',
        content: msg.content
      };
    });
    
    res.json({ success: true, history: mappedMessages });
  } catch (err) {
    console.error('[API History Error]', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const result = await handleIntent(message);
    
    // Broadcast the DJ response to all connected clients
    broadcast({ type: 'DJ_RESPONSE', ...result });
    
    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/like', async (req, res) => {
  try {
    const { song, artist } = req.body;
    const db = require('./src/db');
    await db.saveLike(song, artist);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Real-time Audio Streaming Endpoint
app.get('/api/stream', (req, res) => {
  const videoId = req.query.v;
  if (!videoId) return res.status(400).send('Missing video ID');

  console.log(`[Stream] Starting stream for: ${videoId}`);
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Use yt-dlp to extract best audio and pipe it to ffmpeg for mp3 conversion on the fly
  // This ensures maximum compatibility and zero disk usage.
  // Use absolute paths for production reliability on Ubuntu
  const YT_DLP_PATH = process.platform === 'win32' ? 'yt-dlp' : '/usr/local/bin/yt-dlp';
  const FFMPEG_PATH = process.platform === 'win32' ? 'ffmpeg' : '/usr/bin/ffmpeg';

  const ytdlp = spawn(YT_DLP_PATH, [
    '-f', 'bestaudio',
    '-o', '-',
    '--no-playlist',
    '--quiet',
    '--no-warnings',
    videoUrl
  ]);

  const ffmpeg = spawn(FFMPEG_PATH, [
    '-i', 'pipe:0',
    '-f', 'mp3',
    '-acodec', 'libmp3lame',
    '-ab', '128k',
    'pipe:1'
  ]);

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Transfer-Encoding', 'chunked');

  // Safety: Handle stdin error to prevent EPIPE crash when processes are killed
  ffmpeg.stdin.on('error', (err) => {
    if (err.code !== 'EPIPE') console.error('[ffmpeg-stdin Error]', err);
  });

  // Pipe the processes together
  ytdlp.stdout.pipe(ffmpeg.stdin);
  ffmpeg.stdout.pipe(res);

  // Handle cleanup when user disconnects or skips
  req.on('close', () => {
    ytdlp.stdout.unpipe(ffmpeg.stdin);
    ffmpeg.stdout.unpipe(res);
    ytdlp.kill('SIGTERM');
    ffmpeg.kill('SIGTERM');
  });

  ytdlp.on('error', err => console.error('[yt-dlp Error]', err));
  ffmpeg.on('error', err => console.error('[ffmpeg Error]', err));
});



const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Claudio Server is ON AIR at http://localhost:${PORT}`);
});

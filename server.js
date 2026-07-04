const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { handleIntent } = require('./src/router');
const { initScheduler } = require('./src/scheduler');
const { cleanupTTS } = require('./src/tts');
const db = require('./src/db');
const stationCtl = require('./src/station');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

stationCtl.setBroadcast(broadcast);

function attachTts(messages) {
  return messages.map(msg => {
    if (msg.role !== 'claudio') {
      return { role: 'user', content: msg.content, createdAt: msg.created_at };
    }
    let ttsUrl = msg.payload?.ttsUrl || null;
    if (!ttsUrl) {
      const cleanText = msg.content.replace(/\[.*?\]/g, '').trim();
      const hash = crypto.createHash('md5').update(cleanText).digest('hex');
      const file = path.join(__dirname, 'public/tts', `${hash}.mp3`);
      if (fs.existsSync(file)) ttsUrl = `/tts/${hash}.mp3`;
    }
    return {
      role: 'claudio',
      content: msg.content,
      createdAt: msg.created_at,
      ttsUrl,
      tracks: msg.payload?.tracks || [],
      intent: msg.payload?.intent || null
    };
  });
}

async function fullState() {
  const messages = await db.getRecentMessages(30);
  return {
    type: 'STATE',
    station: stationCtl.snapshot(),
    history: attachTts(messages),
    listeners: wss.clients.size
  };
}

let curationLock = false;
let radioFillLock = false;
let lastRadioFillAt = 0;
const MIN_UPCOMING = 2;

function upcomingCount() {
  const snap = stationCtl.snapshot();
  if (snap.currentIndex < 0) return snap.queue.length;
  return Math.max(0, snap.queue.length - snap.currentIndex - 1);
}

async function ensureRadioBuffer(reason = 'ambient') {
  stationCtl.trimRolling(MIN_UPCOMING);
  const snap = stationCtl.snapshot();
  if (upcomingCount() >= MIN_UPCOMING && snap.status === 'playing') return;
  if (radioFillLock || curationLock) return;
  if (Date.now() - lastRadioFillAt < 20000) return;
  radioFillLock = true;
  lastRadioFillAt = Date.now();
  try {
    await handleIntent(
      `Keep Claudio FM alive. Add exactly 3 fresh songs to the radio queue for ${reason}. Do not repeat recent tracks. Follow my taste profile, time of day, weather, and the current vibe. Return only real playable song names in the play array.`,
      { silentUser: true, silentDj: true, forceIntent: 'append' }
    );
    stationCtl.trimRolling(MIN_UPCOMING);
  } catch (err) {
    console.error('Radio buffer fill failed:', err.message);
  } finally {
    radioFillLock = false;
  }
}

async function runChat(text, ws) {
  const lower = text.toLowerCase();
  const command = lower.replace(/\s+/g, '');
  if (command === '/clear' || lower === 'clear') {
    await db.clearMessages();
    broadcast({ type: 'CLEAR_HISTORY' });
    broadcast({ type: 'COMMAND_ACK', message: 'CONVERSATION CLEARED' });
    return;
  }
  if (command === '/reset' || lower === 'reset') {
    if (curationLock) {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Claudio is already thinking. One request at a time.' }));
      return;
    }
    curationLock = true;
    try {
      await db.clearTasteMemory();
      stationCtl.clear();
      broadcast({ type: 'CLEAR_HISTORY' });
      broadcast({ type: 'DJ_THINKING' });
      const result = await handleIntent(
        'Search the internet for currently trending global songs and start a fresh worldwide radio set with several popular tracks.',
        { ignoreTaste: true, silentUser: true, forceIntent: 'interrupt' }
      );
      broadcast({ type: 'DJ_MESSAGE', ...result, timestamp: Date.now() });
      ensureRadioBuffer('fresh reset').catch(() => {});
    } catch (err) {
      console.error('Reset failed:', err);
      broadcast({ type: 'ERROR', message: 'Reset failed. Try again.' });
    } finally {
      curationLock = false;
    }
    return;
  }
  if (curationLock) {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Claudio is already thinking. One request at a time.' }));
    return;
  }
  curationLock = true;
  try {
    broadcast({ type: 'USER_MESSAGE', content: text, timestamp: Date.now() });
    broadcast({ type: 'DJ_THINKING' });
    const result = await handleIntent(text);
    broadcast({ type: 'DJ_MESSAGE', ...result, timestamp: Date.now() });
    ensureRadioBuffer('user request').catch(() => {});
  } catch (err) {
    console.error('Chat handling failed:', err);
    broadcast({ type: 'ERROR', message: 'Transmission glitch. Try again.' });
  } finally {
    curationLock = false;
  }
}

wss.on('connection', async (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  try {
    ws.send(JSON.stringify(await fullState()));
  } catch (err) {
    console.error('State snapshot failed:', err);
  }

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    try {
      switch (msg.type) {
        case 'BOOT': {
          if (stationCtl.station.queue.length === 0 && !curationLock) {
            curationLock = true;
            try {
              broadcast({ type: 'DJ_THINKING' });
              const result = await handleIntent(null);
              broadcast({ type: 'DJ_MESSAGE', ...result, timestamp: Date.now() });
            } finally {
              curationLock = false;
            }
          }
          ensureRadioBuffer('station startup').catch(() => {});
          break;
        }
        case 'CHAT': {
          const text = typeof msg.text === 'string' ? msg.text.trim() : '';
          if (text.length === 0 || text.length > 600) return;
          await runChat(text, ws);
          break;
        }
        case 'PLAY_INDEX':
          if (Number.isInteger(msg.index)) {
            stationCtl.playIndex(msg.index);
            ensureRadioBuffer('manual queue jump').catch(() => {});
          }
          break;
        case 'NEXT':
          stationCtl.next();
          ensureRadioBuffer('next track').catch(() => {});
          break;
        case 'PREV':
          stationCtl.prev();
          break;
        case 'STOP':
          stationCtl.stop();
          break;
        case 'PAUSE':
          stationCtl.setStatus('paused');
          break;
        case 'RESUME':
          stationCtl.setStatus('playing');
          break;
        case 'PROGRESS':
          if (typeof msg.position === 'number') {
            stationCtl.setProgress(msg.position);
            if (upcomingCount() < MIN_UPCOMING) ensureRadioBuffer('low queue').catch(() => {});
          }
          break;
        case 'TRACK_ENDED':
          if (Number.isInteger(msg.index)) {
            stationCtl.onTrackEnded(msg.index);
            ensureRadioBuffer('track ended').catch(() => {});
          }
          break;
      }
    } catch (err) {
      console.error('WS message error:', err);
    }
  });
});

setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

initScheduler(broadcast);
setInterval(cleanupTTS, 60 * 1000);
setInterval(() => ensureRadioBuffer('continuous radio').catch(() => {}), 45000);

app.get('/api/state', async (req, res) => {
  try {
    res.json(await fullState());
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    const messages = await db.getRecentMessages(30);
    res.json({ success: true, history: attachTts(messages) });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/profile', async (req, res) => {
  try {
    let genres = [];
    try {
      const taste = fs.readFileSync(path.join(__dirname, 'user/taste.md'), 'utf-8');
      const known = ['Chinese acoustic', 'light indie', 'ambient', 'lo-fi', 'Neo-classical', 'soft rock', 'Chillhop', 'Bread', 'Harry Styles', 'Ed Sheeran'];
      genres = known.filter(item => taste.toLowerCase().includes(item.toLowerCase())).slice(0, 8);
    } catch {}
    const stats = await db.getStats();
    res.json({
      name: 'Claudio',
      tagline: 'Your mood is my prompt.',
      bio: ['Personal AI DJ, spinning taste.md', 'Your mood is my prompt.', 'I hate algorithm. I have taste.'],
      onAir: '24/7',
      genres,
      listeners: wss.clients.size || 1,
      stats
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/likes', async (req, res) => {
  try {
    res.json({ success: true, likes: await db.getLikes(50) });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/like', async (req, res) => {
  try {
    const { song, artist } = req.body;
    if (typeof song !== 'string' || song.trim().length === 0 || typeof artist !== 'string' || artist.trim().length === 0) {
      return res.status(400).json({ error: 'Song and artist are required' });
    }
    if (song.length > 200 || artist.length > 200) {
      return res.status(413).json({ error: 'Song or artist value is too long' });
    }
    await db.saveLike(song.trim(), artist.trim());
    broadcast({ type: 'LIKE_ACK', song: song.trim(), artist: artist.trim() });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > 600) {
      return res.status(413).json({ error: 'Message is too long' });
    }
    broadcast({ type: 'USER_MESSAGE', content: message.trim(), timestamp: Date.now() });
    const result = await handleIntent(message.trim());
    broadcast({ type: 'DJ_MESSAGE', ...result, timestamp: Date.now() });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/stream', (req, res) => {
  const videoId = req.query.v;
  if (!videoId) return res.status(400).send('Missing video ID');
  if (typeof videoId !== 'string' || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).send('Invalid video ID');
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const YT_DLP_PATH = process.platform === 'win32' ? 'yt-dlp' : '/usr/local/bin/yt-dlp';
  const FFMPEG_PATH = process.platform === 'win32' ? 'ffmpeg' : '/usr/bin/ffmpeg';

  const args = [
    '-f', 'bestaudio',
    '-o', '-',
    '--no-playlist',
    '--quiet',
    '--no-warnings'
  ];

  const cookiesPath = path.join(__dirname, 'cookies.txt');
  if (fs.existsSync(cookiesPath)) {
    args.push('--cookies', cookiesPath);
  }

  args.push(videoUrl);

  const ytdlp = spawn(YT_DLP_PATH, args);

  const ffmpeg = spawn(FFMPEG_PATH, [
    '-i', 'pipe:0',
    '-f', 'mp3',
    '-acodec', 'libmp3lame',
    '-ab', '128k',
    'pipe:1'
  ]);

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Transfer-Encoding', 'chunked');

  ffmpeg.stdin.on('error', (err) => {
    if (err.code !== 'EPIPE') console.error('ffmpeg stdin error:', err);
  });

  ytdlp.stdout.pipe(ffmpeg.stdin);
  ffmpeg.stdout.pipe(res);

  req.on('close', () => {
    ytdlp.stdout.unpipe(ffmpeg.stdin);
    ffmpeg.stdout.unpipe(res);
    ytdlp.kill('SIGTERM');
    ffmpeg.kill('SIGTERM');
  });

  ytdlp.on('error', err => {
    console.error('yt-dlp error:', err);
    if (!res.headersSent) res.status(502).send('Audio extractor failed');
  });
  ffmpeg.on('error', err => {
    console.error('ffmpeg error:', err);
    if (!res.headersSent) res.status(502).send('Audio encoder failed');
  });
});

const PORT = process.env.PORT || 8080;

(async () => {
  await db.ready;
  await stationCtl.hydrate();
  stationCtl.trimRolling(MIN_UPCOMING);
  server.listen(PORT, () => {
    console.log(`Claudio Server is ON AIR at http://localhost:${PORT}`);
    ensureRadioBuffer('server boot').catch(() => {});
  });
})();

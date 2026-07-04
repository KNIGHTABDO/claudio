const { getDJResponse } = require('./claude');
const { searchSong } = require('./music');
const { generateSpeech } = require('./tts');
const db = require('./db');
const stationCtl = require('./station');

async function handleIntent(userInput, options = {}) {
  if (userInput && !options.silentUser) {
    await db.saveMessage('user', userInput);
  }

  const aiDecision = await getDJResponse(userInput, options);

  if (userInput) {
    const appendKeywords = ['queue', 'add to queue', 'append', 'later', 'next in line', 'add this'];
    const hasAppendRequest = appendKeywords.some(k => userInput.toLowerCase().includes(k));
    aiDecision.intent = options.forceIntent || (hasAppendRequest ? 'append' : 'interrupt');
  }

  let ttsUrl = null;
  if (!options.silentDj) {
    try {
      ttsUrl = await generateSpeech(aiDecision.say);
    } catch (err) {
      console.error('TTS generation failed:', err.message);
    }
  }

  const tracks = [];
  const playList = Array.isArray(aiDecision.play) ? aiDecision.play : [];
  for (const songQuery of playList) {
    try {
      const track = await searchSong(songQuery);
      if (track) {
        tracks.push(track);
        await db.savePlay(track.name, track.artist);
      }
    } catch (err) {
      console.error(`Track resolution failed for "${songQuery}":`, err.message);
    }
  }

  const payload = {
    tracks,
    ttsUrl,
    intent: aiDecision.intent || 'append',
    reason: aiDecision.reason || '',
    segue: aiDecision.segue || ''
  };

  if (!options.silentDj) {
    await db.saveMessage('claudio', aiDecision.say, payload);
  }

  if (tracks.length > 0) {
    if (payload.intent === 'interrupt') stationCtl.replaceQueue(tracks);
    else stationCtl.appendTracks(tracks);
  }

  return {
    speech: aiDecision.say,
    ttsUrl,
    tracks,
    intent: payload.intent,
    metadata: { reason: payload.reason, segue: payload.segue }
  };
}

module.exports = { handleIntent };

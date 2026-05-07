const { getDJResponse } = require('./claude');
const { searchSong } = require('./music');
const { generateSpeech } = require('./tts');
const db = require('./db');

async function handleIntent(userInput) {
  // 1. Save user message
  if (userInput) {
    await db.saveMessage('user', userInput);
  }

  // 2. Get Brain Decision (Claude)
  const aiDecision = await getDJResponse(userInput);
  
  // FORCE INTERRUPT OVERRIDE: If user uses switch/play/change keywords
  const forceKeywords = ['play', 'switch', 'change', 'stop', 'something else', 'next'];
  if (userInput && forceKeywords.some(k => userInput.toLowerCase().includes(k))) {
    aiDecision.intent = 'interrupt';
    console.log('!!! BACKEND OVERRIDE: Forcing Interrupt intent !!!');
  }
  
  console.log('DJ Decision:', aiDecision.reason);


  // 3. Save DJ message
  await db.saveMessage('claudio', aiDecision.say);

  // 4. Generate TTS for DJ speech
  let ttsUrl = null;
  try {
    ttsUrl = await generateSpeech(aiDecision.say);
  } catch (err) {
    console.error('TTS Generation failed:', err);
  }

  // 5. Resolve songs to playable tracks
  const tracksToQueue = [];
  for (let songQuery of aiDecision.play) {
    const track = await searchSong(songQuery);
    if (track) {
      tracksToQueue.push(track);
      // Save to play history
      await db.savePlay(track.name, track.artist);
    }
  }

  return {
    speech: aiDecision.say,
    ttsUrl: ttsUrl,
    queue: tracksToQueue,
    intent: aiDecision.intent || 'append',
    metadata: {
      reason: aiDecision.reason,
      segue: aiDecision.segue
    }
  };
}

module.exports = { handleIntent };

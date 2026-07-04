const db = require('./db');

const station = {
  queue: [],
  currentIndex: -1,
  position: 0,
  status: 'idle',
  startedAt: null
};

let broadcastFn = () => {};
let persistTimer = null;
let endTimer = null;

function setBroadcast(fn) {
  broadcastFn = fn;
}

function snapshot() {
  return {
    queue: station.queue,
    currentIndex: station.currentIndex,
    position: station.position,
    status: station.status,
    startedAt: station.startedAt
  };
}

function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    db.saveStationState(station.queue, station.currentIndex, station.position, station.status).catch(() => {});
  }, 250);
}

function emitQueue() {
  broadcastFn({ type: 'QUEUE_UPDATE', queue: station.queue, currentIndex: station.currentIndex });
}

function emitNowPlaying() {
  broadcastFn({
    type: 'NOW_PLAYING',
    track: station.queue[station.currentIndex] || null,
    currentIndex: station.currentIndex,
    status: station.status,
    position: station.position,
    startedAt: station.startedAt
  });
}

function scheduleEndTimer() {
  clearTimeout(endTimer);
  if (station.status !== 'playing') return;
  const track = station.queue[station.currentIndex];
  const duration = Number(track?.duration || 0);
  if (!duration) return;
  const left = Math.max(15, duration - (station.position || 0) + 15);
  endTimer = setTimeout(() => {
    onTrackEnded(station.currentIndex);
  }, left * 1000);
}

async function hydrate() {
  try {
    const saved = await db.loadStationState();
    if (saved && saved.queue.length > 0) {
      station.queue = saved.queue;
      station.currentIndex = Math.min(saved.currentIndex, saved.queue.length - 1);
      station.position = saved.position || 0;
      station.status = saved.status === 'playing' ? 'paused' : (saved.status || 'idle');
    }
  } catch {}
}

function replaceQueue(tracks) {
  station.queue = tracks;
  station.currentIndex = tracks.length > 0 ? 0 : -1;
  station.position = 0;
  station.status = tracks.length > 0 ? 'playing' : 'idle';
  station.startedAt = Date.now();
  persist();
  emitQueue();
  emitNowPlaying();
  scheduleEndTimer();
}

function appendTracks(tracks) {
  const wasEmpty = station.queue.length === 0;
  const oldLength = station.queue.length;
  const shouldStart = tracks.length > 0 && !wasEmpty && station.status !== 'playing' && station.currentIndex >= oldLength - 1;
  station.queue = station.queue.concat(tracks);
  if ((wasEmpty || shouldStart) && station.queue.length > 0) {
    station.currentIndex = wasEmpty ? 0 : oldLength;
    station.position = 0;
    station.status = 'playing';
    station.startedAt = Date.now();
  }
  persist();
  emitQueue();
  if (wasEmpty || shouldStart) {
    emitNowPlaying();
    scheduleEndTimer();
  }
}

function playIndex(index) {
  if (index < 0 || index >= station.queue.length) return;
  station.currentIndex = index;
  station.position = 0;
  station.status = 'playing';
  station.startedAt = Date.now();
  persist();
  emitQueue();
  emitNowPlaying();
  scheduleEndTimer();
}

function next() {
  if (station.currentIndex < station.queue.length - 1) {
    playIndex(station.currentIndex + 1);
    return true;
  }
  station.status = 'idle';
  persist();
  emitNowPlaying();
  scheduleEndTimer();
  return false;
}

function prev() {
  if (station.currentIndex > 0) playIndex(station.currentIndex - 1);
  else playIndex(0);
}

function stop() {
  station.status = 'stopped';
  station.position = 0;
  persist();
  emitNowPlaying();
  scheduleEndTimer();
}

function clear() {
  station.queue = [];
  station.currentIndex = -1;
  station.position = 0;
  station.status = 'idle';
  station.startedAt = null;
  persist();
  emitQueue();
  emitNowPlaying();
  scheduleEndTimer();
}

function setStatus(status) {
  station.status = status;
  if (status === 'playing') station.startedAt = Date.now();
  persist();
  emitNowPlaying();
  scheduleEndTimer();
}

function setProgress(position) {
  station.position = position;
  persist();
  scheduleEndTimer();
}

function onTrackEnded(index) {
  if (index !== station.currentIndex) return;
  next();
}

function trimRolling(maxUpcoming = 2) {
  const current = station.queue[station.currentIndex] || null;
  if (!current) {
    if (station.queue.length > maxUpcoming + 1) station.queue = station.queue.slice(0, maxUpcoming + 1);
    station.currentIndex = station.queue.length ? 0 : -1;
    persist();
    emitQueue();
    return;
  }
  const upcoming = station.queue.slice(station.currentIndex + 1, station.currentIndex + 1 + maxUpcoming);
  if (station.currentIndex === 0 && station.queue.length === 1 + upcoming.length) return;
  station.queue = [current].concat(upcoming);
  station.currentIndex = 0;
  persist();
  emitQueue();
}

module.exports = {
  station,
  setBroadcast,
  snapshot,
  hydrate,
  replaceQueue,
  appendTracks,
  playIndex,
  next,
  prev,
  stop,
  clear,
  setStatus,
  setProgress,
  onTrackEnded,
  trimRolling
};

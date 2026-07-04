import { getState, setStation } from './state.js';

const fmt = value => {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const m = Math.floor(value / 60);
  const s = Math.floor(value % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export function createAudio(socket, els) {
  const music = els.music;
  const tts = els.tts;
  let currentId = null;
  let userPaused = false;
  let duckTimer = null;
  let lastReport = 0;
  let resumeAppliedFor = null;

  function targetVolume() {
    return getState().volume / 100;
  }

  function setBaseVolume() {
    if (tts.paused) music.volume = targetVolume();
    tts.volume = Math.min(1, targetVolume() + 0.15);
  }

  function ramp(to) {
    clearInterval(duckTimer);
    const from = music.volume;
    const start = performance.now();
    duckTimer = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / 300);
      music.volume = from + (to - from) * p;
      if (p >= 1) clearInterval(duckTimer);
    }, 16);
  }

  function unlock() {
    music.muted = true;
    tts.muted = true;
    if (music.src) music.play().catch(() => {});
    if (tts.src) tts.play().catch(() => {});
    music.pause();
    tts.pause();
    music.muted = false;
    tts.muted = false;
    setBaseVolume();
  }

  async function playTrack(track, position = 0) {
    if (!track || !track.url) return;
    const id = track.id || track.videoId || track.url;
    if (id !== currentId) {
      currentId = id;
      music.src = track.url;
      music.load();
      resumeAppliedFor = null;
    }
    if (position > 0 && resumeAppliedFor !== id) {
      const apply = () => {
        try { music.currentTime = position; } catch {}
        resumeAppliedFor = id;
      };
      if (music.readyState >= 1) apply();
      else music.addEventListener('loadedmetadata', apply, { once: true });
    }
    userPaused = false;
    setBaseVolume();
    try { await music.play(); } catch {}
  }

  function stop() {
    music.pause();
    music.removeAttribute('src');
    currentId = null;
    els.cur.textContent = '0:00';
    els.total.textContent = '0:00';
    els.fill.style.width = '0%';
  }

  function syncStation(station) {
    const track = station.queue[station.currentIndex] || station.track || null;
    if (station.status === 'playing') playTrack(track, station.position || 0);
    if (station.status === 'paused') music.pause();
    if (station.status === 'stopped' || station.status === 'idle') {
      if (!track) stop();
      else music.pause();
    }
  }

  function playTts(url) {
    if (!url) return;
    tts.src = url;
    tts.currentTime = 0;
    tts.play().catch(() => {});
  }

  function toggle() {
    const st = getState().station;
    const track = st.queue[st.currentIndex] || st.track || null;
    if (!track) return;
    if (music.paused) {
      userPaused = false;
      socket.send('RESUME');
      playTrack(track, music.currentTime || st.position || 0);
    } else {
      userPaused = true;
      music.pause();
      socket.send('PAUSE');
    }
  }

  tts.addEventListener('play', () => ramp(targetVolume() * 0.2));
  tts.addEventListener('ended', () => ramp(targetVolume()));
  tts.addEventListener('pause', () => ramp(targetVolume()));

  music.addEventListener('timeupdate', () => {
    const st = getState().station;
    const track = st.queue[st.currentIndex] || st.track || {};
    const duration = Number.isFinite(music.duration) && music.duration > 0 ? music.duration : track.duration || 0;
    const pct = duration > 0 ? Math.min(100, (music.currentTime / duration) * 100) : 0;
    els.cur.textContent = fmt(music.currentTime);
    els.total.textContent = fmt(duration);
    els.fill.style.width = `${pct}%`;
    if (Date.now() - lastReport > 10000) {
      lastReport = Date.now();
      socket.send('PROGRESS', { index: st.currentIndex, position: music.currentTime });
      setStation({ position: music.currentTime });
    }
  });

  music.addEventListener('play', () => {
    els.eq.classList.add('playing');
    setStation({ status: 'playing' });
  });

  music.addEventListener('pause', () => {
    els.eq.classList.remove('playing');
    if (userPaused) setStation({ status: 'paused' });
  });

  music.addEventListener('ended', () => {
    socket.send('TRACK_ENDED', { index: getState().station.currentIndex });
  });

  els.bar.addEventListener('click', event => {
    const rect = els.bar.getBoundingClientRect();
    const p = (event.clientX - rect.left) / rect.width;
    const duration = Number.isFinite(music.duration) ? music.duration : 0;
    if (duration > 0) music.currentTime = Math.max(0, Math.min(duration, duration * p));
  });

  return { unlock, syncStation, playTts, toggle, stop, setBaseVolume, format: fmt };
}

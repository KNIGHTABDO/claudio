import { renderStatic, startDotWave } from '../dotmatrix.js';
import { getState, setTheme, setVolume } from './state.js';

export const $ = id => document.getElementById(id);

export function bootStaticCanvases() {
  renderStatic($('wordmark-canvas'), 'Claudio', { dot: 2.6, gap: 2, letterGap: 5 });
  renderStatic($('boot-logo'), 'CLAUDIO', { dot: 3.6, gap: 2.8, letterGap: 7 });
  renderStatic($('profile-name'), 'Claudio', { dot: 3, gap: 2.1, letterGap: 6 });
}

export function initTheme() {
  setTheme(getState().theme);
  document.querySelectorAll('[data-theme-btn]').forEach(btn => {
    btn.addEventListener('click', () => setTheme(btn.dataset.themeBtn));
  });
}

export function renderTheme(theme) {
  document.querySelectorAll('[data-theme-btn]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeBtn === theme);
  });
  bootStaticCanvases();
}

export function initCalendar() {
  const tick = () => {
    const now = new Date();
    $('hero-day').textContent = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    $('hero-date').textContent = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  };
  tick();
  setInterval(tick, 60000);
}

export function renderConnection(status) {
  const el = $('conn-status');
  el.textContent = status === 'connected' ? 'CONNECTED' : status === 'reconnecting' ? 'RECONNECTING' : 'OFFLINE';
  el.classList.toggle('conn-on', status === 'connected');
  el.classList.toggle('conn-off', status !== 'connected');
  $('ticker').textContent = status === 'connected' ? 'LIVE SIGNAL LOCKED' : 'SIGNAL SEARCHING';
}

export function renderPlayer(station) {
  const track = station.queue[station.currentIndex] || station.track || null;
  $('player-title').textContent = track ? `${track.name} - ${track.artist}` : 'STANDBY';
  $('player-status').textContent = (station.status || 'idle').toUpperCase();
  $('btn-play').innerHTML = station.status === 'playing' ? '&#10073;&#10073;' : '&#9654;';
  $('eq').classList.toggle('playing', station.status === 'playing');
}

export function renderQueue(station, socket) {
  const list = $('queue-list');
  const queue = station.queue || [];
  const start = station.currentIndex >= 0 ? station.currentIndex + 1 : 0;
  const upcoming = queue.slice(start);
  $('queue-count').textContent = `${upcoming.length} NEXT`;
  list.innerHTML = '';
  if (upcoming.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'queue-empty';
    empty.textContent = queue.length === 0 ? 'WAITING FOR THE FIRST SIGNAL' : 'NO UPCOMING TRACKS';
    list.append(empty);
    return;
  }
  upcoming.forEach((track, pos) => {
    const idx = start + pos;
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.tabIndex = 0;
    li.innerHTML = `<span class="qi-num">${String(pos + 1).padStart(2, '0')}</span><span class="qi-main"><span class="qi-name"></span><span class="qi-artist"></span></span>`;
    li.querySelector('.qi-name').textContent = track.name || 'Untitled';
    li.querySelector('.qi-artist').textContent = track.artist || 'Unknown';
    li.addEventListener('click', () => socket.send('PLAY_INDEX', { index: idx }));
    li.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') socket.send('PLAY_INDEX', { index: idx });
    });
    list.append(li);
  });
}

export function renderChat(history, station, socket) {
  const chat = $('chat');
  const nearBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 80;
  chat.innerHTML = '';
  history.forEach(msg => {
    const wrap = document.createElement('article');
    wrap.className = `msg msg-${msg.role === 'user' ? 'user' : 'dj'}`;
    const time = new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const content = msg.content || msg.speech || '';
    if (msg.role === 'user') {
      wrap.innerHTML = `<div class="msg-meta">${time}</div><div class="msg-bubble"></div>`;
      wrap.querySelector('.msg-bubble').textContent = content;
    } else {
      wrap.innerHTML = `<div class="msg-meta">CLAUDIO <span>${time}</span></div><div class="msg-body"><div class="msg-avatar">C</div><div class="msg-bubble"></div></div>`;
      wrap.querySelector('.msg-bubble').textContent = content;
      const tracks = msg.tracks || msg.payload?.tracks || [];
      if (tracks.length) {
        const cards = document.createElement('div');
        cards.className = 'msg-tracks';
        tracks.forEach(track => {
          const index = findTrackIndex(station.queue, track);
          const card = document.createElement('button');
          card.type = 'button';
          card.className = `track-card${index === station.currentIndex ? ' active' : ''}`;
          card.innerHTML = `<span class="tc-icon">${index === station.currentIndex ? '&#9733;' : '&#9654;'}</span><span class="tc-copy"><span class="tc-name"></span><span class="tc-artist"></span></span>`;
          card.querySelector('.tc-name').textContent = track.name || 'Untitled';
          card.querySelector('.tc-artist').textContent = track.artist || 'Unknown';
          card.addEventListener('click', () => {
            if (index >= 0) socket.send('PLAY_INDEX', { index });
          });
          cards.append(card);
        });
        wrap.append(cards);
      }
    }
    chat.append(wrap);
  });
  if (nearBottom) chat.scrollTop = chat.scrollHeight;
}

export function findTrackIndex(queue, track) {
  const id = track?.id || track?.videoId;
  if (!id) return -1;
  return (queue || []).findIndex(item => (item.id || item.videoId) === id);
}

export function initForm(socket) {
  const form = $('chat-form');
  const input = $('chat-text');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (socket.send('CHAT', { text })) input.value = '';
  });
}

export function initMic(socket) {
  const btn = $('btn-mic');
  const input = $('chat-text');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    btn.hidden = true;
    return;
  }
  const rec = new SpeechRecognition();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = navigator.language || 'en-US';
  btn.addEventListener('click', () => {
    try {
      rec.start();
      btn.classList.add('rec');
    } catch {}
  });
  rec.addEventListener('result', event => {
    let text = '';
    for (let i = event.resultIndex; i < event.results.length; i++) text += event.results[i][0].transcript;
    input.value = text.trim();
    if (event.results[event.results.length - 1].isFinal && input.value) {
      socket.send('CHAT', { text: input.value });
      input.value = '';
    }
  });
  rec.addEventListener('end', () => btn.classList.remove('rec'));
}

export function initProfile() {
  const modal = $('profile-modal');
  const open = () => {
    modal.hidden = false;
    loadProfile();
    startDotWave($('profile-wave'));
  };
  const close = () => { modal.hidden = true; };
  $('profile-btn').addEventListener('click', open);
  $('profile-close').addEventListener('click', close);
  $('profile-backdrop').addEventListener('click', close);
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
}

async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    const profile = await res.json();
    $('profile-bio').innerHTML = '';
    (profile.bio || []).forEach(line => {
      const p = document.createElement('p');
      p.textContent = line;
      $('profile-bio').append(p);
    });
    $('stat-listeners').textContent = profile.listeners || 1;
    $('stat-onair').textContent = profile.onAir || '24/7';
    $('profile-genres').innerHTML = '';
    const genres = profile.genres?.length ? profile.genres : ['JAZZ-HIPHOP', 'NEO-CLASSICAL', 'CHILLHOP', 'SOFT ROCK'];
    genres.forEach(genre => {
      const pill = document.createElement('span');
      pill.className = 'genre-pill';
      pill.textContent = genre.toUpperCase();
      $('profile-genres').append(pill);
    });
  } catch {}
}

export function initControls(socket, audio) {
  $('btn-prev').addEventListener('click', () => socket.send('PREV'));
  $('btn-next').addEventListener('click', () => socket.send('NEXT'));
  $('btn-stop').addEventListener('click', () => {
    socket.send('STOP');
    audio.stop();
  });
  $('btn-play').addEventListener('click', () => audio.toggle());
  $('btn-like').addEventListener('click', async () => {
    const st = getState().station;
    const track = st.queue[st.currentIndex] || st.track;
    if (!track) return;
    try {
      await fetch('/api/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: track.name, artist: track.artist })
      });
      $('btn-like').classList.add('liked');
      $('btn-like').innerHTML = '&#9829;';
      showToast('SAVED TO FAVORITES');
    } catch {
      showToast('LIKE FAILED');
    }
  });
  $('vol-slider').value = getState().volume;
  $('vol-slider').addEventListener('input', event => {
    setVolume(Number(event.target.value));
    audio.setBaseVolume();
  });
  $('btn-hide').addEventListener('click', () => {
    const hidden = $('hero').classList.toggle('hidden-hero');
    $('btn-hide').textContent = hidden ? 'SHOW' : 'HIDE';
  });
}

export function showToast(text) {
  const toast = $('toast');
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 2600);
}

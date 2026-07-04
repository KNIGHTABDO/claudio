const state = {
  station: {
    queue: [],
    currentIndex: -1,
    position: 0,
    status: 'idle',
    startedAt: null
  },
  history: [],
  listeners: 1,
  connection: 'offline',
  thinking: false,
  volume: Number(localStorage.getItem('claudio-volume') || 80),
  theme: localStorage.getItem('claudio-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
  booted: false,
  likes: new Set()
};

const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function patch(next) {
  Object.assign(state, next);
  listeners.forEach(fn => fn(state));
}

export function setStation(next) {
  state.station = { ...state.station, ...next };
  listeners.forEach(fn => fn(state));
}

export function addHistory(msg) {
  state.history = state.history.concat(msg).slice(-80);
  listeners.forEach(fn => fn(state));
}

export function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem('claudio-theme', theme);
  document.documentElement.dataset.theme = theme;
  listeners.forEach(fn => fn(state));
}

export function setVolume(volume) {
  state.volume = Math.max(0, Math.min(100, volume));
  localStorage.setItem('claudio-volume', String(state.volume));
  listeners.forEach(fn => fn(state));
}

export function markBooted() {
  state.booted = true;
  listeners.forEach(fn => fn(state));
}

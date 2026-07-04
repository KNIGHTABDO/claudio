import { addHistory, getState, patch, setStation } from './state.js';

export class ClaudioSocket {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
    this.retries = 0;
    this.manualClose = false;
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type).delete(fn);
  }

  emit(type, data) {
    const handlers = this.handlers.get(type);
    if (handlers) handlers.forEach(fn => fn(data));
  }

  connect() {
    this.manualClose = false;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}/ws`);
    patch({ connection: 'reconnecting' });

    this.ws.addEventListener('open', () => {
      this.retries = 0;
      patch({ connection: 'connected' });
      this.emit('open');
    });

    this.ws.addEventListener('message', event => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      this.route(msg);
      this.emit(msg.type, msg);
      this.emit('*', msg);
    });

    this.ws.addEventListener('close', () => {
      patch({ connection: 'offline' });
      if (!this.manualClose) this.reconnect();
    });

    this.ws.addEventListener('error', () => {
      patch({ connection: 'offline' });
    });
  }

  reconnect() {
    const wait = Math.min(12000, 700 * Math.pow(1.7, this.retries++));
    setTimeout(() => this.connect(), wait);
  }

  send(type, data = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ type, ...data }));
    return true;
  }

  route(msg) {
    if (msg.type === 'STATE') {
      setStation(msg.station || {});
      patch({
        history: Array.isArray(msg.history) ? msg.history : [],
        listeners: msg.listeners || 1,
        thinking: false
      });
    }
    if (msg.type === 'QUEUE_UPDATE') {
      setStation({ queue: msg.queue || [], currentIndex: msg.currentIndex ?? -1 });
    }
    if (msg.type === 'NOW_PLAYING') {
      setStation({
        currentIndex: msg.currentIndex ?? -1,
        status: msg.status || 'idle',
        track: msg.track || null,
        position: msg.position ?? 0
      });
    }
    if (msg.type === 'DJ_MESSAGE') {
      patch({ thinking: false });
      addHistory({
        role: 'claudio',
        content: msg.speech || msg.say || msg.content || '',
        ttsUrl: msg.ttsUrl || null,
        tracks: msg.tracks || [],
        metadata: msg.metadata || {},
        createdAt: msg.timestamp || Date.now()
      });
    }
    if (msg.type === 'USER_MESSAGE') {
      addHistory({
        role: 'user',
        content: msg.content || msg.text || '',
        createdAt: msg.timestamp || Date.now()
      });
    }
    if (msg.type === 'DJ_THINKING') patch({ thinking: true });
    if (msg.type === 'CLEAR_HISTORY') patch({ history: [], thinking: false });
    if (msg.type === 'ERROR') patch({ thinking: false });
    if (msg.type === 'LIKE_ACK') {
      const key = `${msg.song || ''}::${msg.artist || ''}`;
      const next = new Set(getState().likes || []);
      next.add(key);
      patch({ likes: next });
    }
  }
}

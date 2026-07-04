import { DotClock } from '../dotmatrix.js';
import { ClaudioSocket } from './ws.js';
import { markBooted, subscribe } from './state.js';
import { createAudio } from './audio.js';
import {
  $,
  bootStaticCanvases,
  initCalendar,
  initControls,
  initForm,
  initMic,
  initProfile,
  initTheme,
  renderChat,
  renderConnection,
  renderPlayer,
  renderQueue,
  renderTheme,
  showToast
} from './ui.js';

const socket = new ClaudioSocket();
const clock = new DotClock($('clock'));
const audio = createAudio(socket, {
  music: $('audio-music'),
  tts: $('audio-tts'),
  cur: $('time-cur'),
  total: $('time-total'),
  fill: $('pbar-fill'),
  bar: $('pbar'),
  eq: $('eq')
});

bootStaticCanvases();
initTheme();
initCalendar();
initForm(socket);
initMic(socket);
initProfile();
initControls(socket, audio);
clock.start();
socket.connect();

socket.on('DJ_MESSAGE', msg => {
  if (msg.ttsUrl) audio.playTts(msg.ttsUrl);
});

socket.on('ERROR', msg => {
  showToast(msg.message || 'TRANSMISSION FAILED');
});

socket.on('COMMAND_ACK', msg => {
  showToast(msg.message || 'DONE');
});

subscribe(state => {
  document.documentElement.dataset.theme = state.theme;
  renderTheme(state.theme);
  renderConnection(state.connection);
  renderPlayer(state.station);
  renderQueue(state.station, socket);
  renderChat(state.history, state.station, socket);
  $('thinking').hidden = !state.thinking;
  $('station').classList.toggle('on', state.booted);
  if (state.booted) $('boot').classList.add('off');
  audio.syncStation(state.station);
});

$('boot-btn').addEventListener('click', async () => {
  markBooted();
  audio.unlock();
  socket.send('BOOT');
});

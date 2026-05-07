const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatHistory = document.getElementById('chat-history');
const clockEl = document.getElementById('clock');
const dayEl = document.getElementById('day-name');
const dateEl = document.getElementById('date-string');
const audioPlayer = document.getElementById('audio-player');
const ttsPlayer = document.getElementById('tts-player');
const playPauseBtn = document.getElementById('play-pause');
const currentTrackTitle = document.getElementById('current-track-title');
const playerStatus = document.getElementById('player-status');
const progressFill = document.getElementById('progress-fill');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const volumeSlider = document.getElementById('volume');

let queue = [];
let isPlaying = false;
let currentTrackIndex = -1;
let currentTrack = null;

// Clock Logic
function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    clockEl.innerHTML = `${h}<span class="digital-clock-colon mx-1">:</span>${m}`;
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    const dateStr = now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
    if (dayEl) dayEl.innerText = dayName;
    if (dateEl) dateEl.innerText = dateStr;
}
setInterval(updateClock, 1000);
updateClock();

// Volume Control
if (volumeSlider) {
    volumeSlider.oninput = (e) => {
        const v = e.target.value / 100;
        audioPlayer.volume = v;
        ttsPlayer.volume = v;
    };
}

// WebSocket Logic
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}/stream`);

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'DJ_RESPONSE' || data.type === 'DJ_ROUTINE') {
        addMessage('claudio', data.speech, data.ttsUrl);
        
        // Always speak if TTS URL exists
        if (data.ttsUrl) {
            // If it's an interrupt, we kill the music first, then play sequence
            if (data.intent === 'interrupt') {
                stopEverything();
                if (data.queue && data.queue.length > 0) {
                    queue = [...data.queue];
                    playSequence(data.ttsUrl);
                } else {
                    playTTS(data.ttsUrl);
                }
            } else {
                // If it's just a chat or append, we talk over music
                if (data.queue && data.queue.length > 0) {
                    const isFirstBatch = (currentTrackIndex === -1);
                    queue = [...queue, ...data.queue];
                    if (isFirstBatch) playSequence(data.ttsUrl);
                    else playTTS(data.ttsUrl);
                } else {
                    playTTS(data.ttsUrl);
                }
            }
        }
    }
};

function stopEverything() {
    queue = []; currentTrackIndex = -1; currentTrack = null;
    audioPlayer.pause(); audioPlayer.src = ""; audioPlayer.removeAttribute('src'); audioPlayer.load();
    ttsPlayer.pause(); ttsPlayer.src = ""; ttsPlayer.removeAttribute('src'); ttsPlayer.load();
    isPlaying = false; updatePlayBtn();
    currentTrackTitle.innerText = "Signal Lost..."; playerStatus.innerText = "IDLE";
}

async function playSequence(ttsUrl) {
    playNext();
    if (ttsUrl) playTTS(ttsUrl);
}

function playTTS(url, btn = null) {
    return new Promise((resolve) => {
        const originalVolume = audioPlayer.volume;
        audioPlayer.volume = originalVolume * 0.2;
        playerStatus.innerText = 'DJ TRANSMITTING';
        ttsPlayer.src = url;
        
        const cleanup = () => {
            ttsPlayer.onended = null;
            ttsPlayer.onerror = null;
            audioPlayer.volume = originalVolume;
            playerStatus.innerText = isPlaying ? 'PLAYING' : 'IDLE';
            resolve();
        };

        ttsPlayer.onended = cleanup;
        ttsPlayer.onerror = (e) => {
            console.error('TTS Playback Failed');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-history"></i> Expired';
                btn.classList.add('opacity-30');
                btn.onclick = null;
            }
            cleanup();
        };

        ttsPlayer.play().catch(err => {
            console.error('TTS Failed:', err);
            cleanup();
        });
    });
}

function playNext() {
    currentTrackIndex++;
    if (currentTrackIndex < queue.length) {
        currentTrack = queue[currentTrackIndex];
        currentTrackTitle.innerText = `${currentTrack.name} - ${currentTrack.artist}`;
        playerStatus.innerText = 'PLAYING';
        updateMoodColor(currentTrack.cover);
        audioPlayer.onended = () => playNext();
        audioPlayer.onerror = () => playNext();
        audioPlayer.src = currentTrack.url;
        audioPlayer.play().catch(() => playNext());
        isPlaying = true; updatePlayBtn();
    } else {
        playerStatus.innerText = 'IDLE'; currentTrackIndex = -1; queue = []; isPlaying = false; updatePlayBtn();
    }
}

function updateMoodColor(imageUrl) {
    if (!imageUrl) return;
    const img = new Image(); img.crossOrigin = "Anonymous"; img.src = imageUrl;
    img.onload = () => {
        const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
        canvas.width = 1; canvas.height = 1; ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        const color = `rgb(${r}, ${g}, ${b})`;
        const glow = `rgba(${r}, ${g}, ${b}, 0.3)`;
        document.documentElement.style.setProperty('--accent-color', color);
        document.documentElement.style.setProperty('--accent-glow', glow);
        document.querySelectorAll('.status-dot').forEach(dot => {
            dot.style.backgroundColor = color; dot.style.boxShadow = `0 0 10px ${color}`;
        });
    };
}

function addMessage(role, content, ttsUrl = null) {
    const div = document.createElement('div');
    div.className = `flex gap-6 ${role === 'user' ? 'self-end max-w-[80%] flex-row-reverse' : 'max-w-[90%]'}`;
    const avatar = role === 'user' ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=User' : 'https://api.dicebear.com/7.x/bottts/svg?seed=Claudio';
    
    let replayHtml = '';
    if (role === 'claudio' && ttsUrl) {
        const btnId = `replay-${Math.random().toString(36).substr(2, 9)}`;
        replayHtml = `
            <button id="${btnId}" class="replay-btn hover:text-white transition-colors flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-md border border-white/10 mt-2 text-[10px]">
                <i class="fas fa-play text-[8px]"></i> Replay
            </button>
        `;
        setTimeout(() => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.innerHTML = '<i class="fas fa-history text-[8px]"></i> Expired';
                btn.classList.add('opacity-30');
                btn.onclick = null;
                btn.style.pointerEvents = 'none';
            }
        }, 180000); 
    }

    div.innerHTML = `
        <img src="${avatar}" class="w-10 h-10 rounded-full border border-white/10 self-start mt-1 bg-white/5 p-1">
        <div class="flex flex-col gap-2 ${role === 'user' ? 'items-end' : ''}">
            <span class="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">${role === 'user' ? 'You' : 'Claudio'}</span>
            <div class="${role === 'user' ? 'glass-panel p-4 text-white/90' : 'chat-bubble p-6 text-white/80'} text-sm leading-relaxed">
                ${content}
                ${replayHtml}
            </div>
            <span class="text-[10px] text-white/10 mono-text">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
    `;
    chatHistory.appendChild(div);
    if (ttsUrl) {
        const btn = div.querySelector('.replay-btn');
        if (btn) btn.onclick = () => playTTS(ttsUrl, btn);
    }
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

document.getElementById('send-btn').onclick = sendMessage;
chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
document.getElementById('stop').onclick = stopEverything;
document.getElementById('prev').onclick = () => {
    if (audioPlayer.currentTime > 3) audioPlayer.currentTime = 0;
    else if (currentTrackIndex > 0) { currentTrackIndex -= 2; playNext(); }
};

const likeBtn = document.querySelector('.far.fa-heart').parentElement;
likeBtn.onclick = async () => {
    if (!currentTrack) return;
    likeBtn.classList.toggle('text-red-500');
    likeBtn.innerHTML = likeBtn.classList.contains('text-red-500') ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
    await fetch('/api/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: currentTrack.name, artist: currentTrack.artist })
    });
    addMessage('user', `I really like "${currentTrack.name}"!`);
    await sendMessageToServer(`I just liked "${currentTrack.name}" by ${currentTrack.artist}. Remember this for my taste profile.`);
};

document.querySelectorAll('.text-btn').forEach(btn => {
    btn.onclick = () => {
        const text = btn.innerText.toUpperCase();
        if (text === 'HIDE' || text === 'SHOW') {
            const clockSection = document.getElementById('clock').parentElement;
            clockSection.classList.toggle('hidden');
            btn.innerText = clockSection.classList.contains('hidden') ? 'SHOW' : 'HIDE';
        } else if (text === 'FAV') alert('Added to favorites!');
    };
});

const btnDark = document.getElementById('btn-dark');
const btnLight = document.getElementById('btn-light');
function setTheme(mode) {
    if (mode === 'light') {
        document.body.classList.add('light-mode');
        btnLight.className = "text-[10px] bg-white text-black px-4 py-1.5 rounded-full font-bold uppercase tracking-wider transition-all";
        btnDark.className = "text-[10px] text-white/40 px-4 py-1.5 rounded-full uppercase tracking-wider hover:text-white transition-all";
    } else {
        document.body.classList.remove('light-mode');
        btnDark.className = "text-[10px] bg-white text-black px-4 py-1.5 rounded-full font-bold uppercase tracking-wider transition-all";
        btnLight.className = "text-[10px] text-white/40 px-4 py-1.5 rounded-full uppercase tracking-wider hover:text-white transition-all";
    }
}
btnDark.onclick = () => setTheme('dark');
btnLight.onclick = () => setTheme('light');

function formatTime(s) { if (!isFinite(s)) return '0:00'; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${String(sec).padStart(2, '0')}`; }
function updatePlayBtn() {
    const eq = document.getElementById('equalizer'); const icon = playPauseBtn.querySelector('i');
    if (isPlaying) { if (icon) icon.className = 'fas fa-pause text-lg'; if (eq) eq.classList.add('is-playing'); }
    else { if (icon) icon.className = 'fas fa-play text-lg'; if (eq) eq.classList.remove('is-playing'); }
}
async function sendMessage() {
    const text = chatInput.value.trim(); if (!text) return; addMessage('user', text); chatInput.value = ''; await sendMessageToServer(text);
}
audioPlayer.ontimeupdate = () => {
    const d = audioPlayer.duration; const isL = !isL || d === 0;
    progressFill.style.width = `${isL ? 100 : (audioPlayer.currentTime / d) * 100}%`;
    currentTimeEl.innerText = formatTime(audioPlayer.currentTime); durationEl.innerText = isL ? 'LIVE' : formatTime(d);
};
playPauseBtn.onclick = () => { if (audioPlayer.paused) { audioPlayer.play(); isPlaying = true; } else { audioPlayer.pause(); isPlaying = false; } updatePlayBtn(); };
document.getElementById('skip').onclick = () => { if (queue.length > 0 && currentTrackIndex < queue.length - 1) playNext(); else sendMessageToServer("Pick the next set based on the current vibe."); };

async function sendMessageToServer(text) {
    const th = document.getElementById('thinking-indicator'); if (th) th.classList.remove('hidden');
    try { await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) }); }
    catch (err) { console.error(err); } finally { if (th) th.classList.add('hidden'); }
}
window.playTTS = playTTS;

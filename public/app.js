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
let hasInteracted = false;
let pendingRoutine = null;
let isResumedSession = false;

// Ignition Handler
document.getElementById('start-station').onclick = () => {
    hasInteracted = true;
    document.getElementById('ignition-overlay').classList.add('started');
    
    // Connect to WebSocket after user interaction to prevent autoplay block
    if (!ws) {
        initWebSocket();
    }
    
    if (isResumedSession) {
        console.log('[Ignition] Resuming active saved player session...');
        if (isPlaying) {
            audioPlayer.play().catch(err => {
                console.error('[Ignition] Failed to play restored audio stream:', err);
                isPlaying = false;
                updatePlayBtn();
            });
        } else {
            audioPlayer.play().then(() => audioPlayer.pause()).catch(() => {});
        }
        ttsPlayer.play().then(() => ttsPlayer.pause()).catch(() => {});
    } else {
        // Silent play to unlock audio
        audioPlayer.play().then(() => audioPlayer.pause()).catch(() => {});
        ttsPlayer.play().then(() => ttsPlayer.pause()).catch(() => {});
        
        // Play any pending routine that arrived before the user clicked start
        if (pendingRoutine) {
            console.log('[Ignition] Playing pending startup routine...');
            const data = pendingRoutine;
            pendingRoutine = null;
            
            if (data.intent === 'interrupt') {
                stopEverything();
                if (data.queue && data.queue.length > 0) {
                    queue = [...data.queue];
                    playSequence(data.ttsUrl);
                } else if (data.ttsUrl) {
                    playTTS(data.ttsUrl);
                }
            } else {
                if (data.queue && data.queue.length > 0) {
                    const isFirstBatch = (currentTrackIndex === -1);
                    queue = [...queue, ...data.queue];
                    if (isFirstBatch) playSequence(data.ttsUrl);
                    else if (data.ttsUrl) playTTS(data.ttsUrl);
                } else if (data.ttsUrl) {
                    playTTS(data.ttsUrl);
                }
            }
        }
    }
};

// Clock Logic
function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    if (clockEl) clockEl.innerHTML = `${h}<span class="digital-clock-colon mx-1">:</span>${m}`;
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
let ws;

function initWebSocket() {
    console.log('[WebSocket] Initializing broadcast receiver...');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/stream`);

    ws.onopen = () => {
        console.log('[WebSocket] Connected. Sending initialization handshake...');
        ws.send(JSON.stringify({
            type: 'INIT_SESSION',
            resume: isResumedSession
        }));
        isResumedSession = false; // Reset resumed session flag after sending handshake
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'DJ_RESPONSE' || data.type === 'DJ_ROUTINE') {
            addMessage('claudio', data.speech, data.ttsUrl);
            
            if (!hasInteracted) {
                console.log('[WebSocket] Interaction pending. Saving routine for after ignition overlay is clicked.');
                pendingRoutine = data;
                return;
            }
            
            if (data.intent === 'interrupt' && data.queue && data.queue.length > 0) {
                // Check if the requested song is already actively playing (fuzzy similarity check)
                const isSameTrack = currentTrack && data.queue.length === 1 && areTracksSimilar(data.queue[0], currentTrack);
                                    
                if (isSameTrack) {
                    console.log('[WebSocket] Requested song is already playing. Ducking volume and speaking instead of interrupting.');
                    if (data.ttsUrl) {
                        playTTS(data.ttsUrl);
                    }
                } else {
                    stopEverything();
                    queue = [...data.queue];
                    playSequence(data.ttsUrl);
                }
            } else {
                // If intent is append, OR if we have no new tracks to play (pure conversational turn)
                if (data.queue && data.queue.length > 0) {
                    const isFirstBatch = (currentTrackIndex === -1);
                    queue = [...queue, ...data.queue];
                    if (isFirstBatch) {
                        playSequence(data.ttsUrl);
                    } else if (data.ttsUrl) {
                        playTTS(data.ttsUrl);
                    }
                } else if (data.ttsUrl) {
                    // Chat-only turn: Just speak over the currently playing music!
                    playTTS(data.ttsUrl);
                }
            }
        }
    };
    
    ws.onclose = () => {
        console.warn('[WebSocket] Disconnected. Reconnecting in 3s...');
        setTimeout(initWebSocket, 3000);
    };
    
    ws.onerror = (err) => {
        console.error('[WebSocket] Error:', err);
    };
}

function stopEverything() {
    queue = []; currentTrackIndex = -1; currentTrack = null;
    audioPlayer.pause(); audioPlayer.src = ""; audioPlayer.removeAttribute('src'); audioPlayer.load();
    ttsPlayer.pause(); ttsPlayer.src = ""; ttsPlayer.removeAttribute('src'); ttsPlayer.load();
    isPlaying = false; updatePlayBtn();
    currentTrackTitle.innerText = "Signal Lost..."; playerStatus.innerText = "IDLE";
    savePlayerState();
}

async function playSequence(ttsUrl) {
    playNext();
    if (ttsUrl) playTTS(ttsUrl);
}

function playTTS(url, btn = null) {
    if (!hasInteracted) return Promise.resolve();
    return new Promise((resolve) => {
        const originalVolume = audioPlayer.volume;
        audioPlayer.volume = originalVolume * 0.2;
        playerStatus.innerText = 'DJ TRANSMITTING';
        ttsPlayer.src = url;
        
        const cleanup = () => {
            ttsPlayer.onended = null; ttsPlayer.onerror = null;
            audioPlayer.volume = originalVolume;
            playerStatus.innerText = isPlaying ? 'PLAYING' : 'IDLE';
            resolve();
        };

        ttsPlayer.onended = cleanup;
        ttsPlayer.onerror = (e) => {
            console.error('TTS Failed');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-history"></i> Expired';
                btn.classList.add('opacity-30');
                btn.onclick = null;
            }
            cleanup();
        };

        ttsPlayer.play().catch(err => {
            console.error('TTS Playback Blocked:', err);
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
    savePlayerState();
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
    const isLiked = likeBtn.classList.toggle('text-red-500');
    likeBtn.innerHTML = isLiked ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
    
    await fetch('/api/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song: currentTrack.name, artist: currentTrack.artist })
    });
    
    addMessage('user', `I really like "${currentTrack.name}"!`);
    
    // Simulate a friendly local DJ acknowledgement without interrupting the music stream
    setTimeout(() => {
        addMessage('claudio', `I've noted that down in your favorites, sir. Excellent taste!`, null);
    }, 600);
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
    const d = audioPlayer.duration; const isFiniteD = isFinite(d) && d > 0;
    progressFill.style.width = `${isFiniteD ? (audioPlayer.currentTime / d) * 100 : 100}%`;
    currentTimeEl.innerText = formatTime(audioPlayer.currentTime); durationEl.innerText = isFiniteD ? formatTime(d) : 'LIVE';
    savePlayerState();
};

playPauseBtn.onclick = () => { 
    if (audioPlayer.paused) { 
        audioPlayer.play(); isPlaying = true; 
    } else { 
        audioPlayer.pause(); isPlaying = false; 
    } 
    updatePlayBtn(); 
    savePlayerState();
};

document.getElementById('skip').onclick = () => { 
    if (queue.length > 0 && currentTrackIndex < queue.length - 1) playNext(); 
    else sendMessageToServer("Pick the next song based on the current vibe."); 
};

async function sendMessageToServer(text) {
    const th = document.getElementById('thinking-indicator'); if (th) th.classList.remove('hidden');
    try { await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) }); }
    catch (err) { console.error(err); } finally { if (th) th.classList.add('hidden'); }
}

// Fuzzy similarity matching to protect playing song from restarts
function areTracksSimilar(t1, t2) {
    if (!t1 || !t2) return false;
    if (t1.id === t2.id) return true;
    
    const cleanStr = (str) => {
        return str.toLowerCase()
                  .replace(/[\(\)\[\]\-+\|]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
    };
    
    const n1 = cleanStr(t1.name);
    const n2 = cleanStr(t2.name);
    
    if (n1.includes(n2) || n2.includes(n1)) return true;
    
    const words1 = n1.split(' ').filter(w => w.length > 2);
    const words2 = n2.split(' ').filter(w => w.length > 2);
    if (words1.length === 0 || words2.length === 0) return false;
    
    const intersection = words1.filter(w => words2.includes(w));
    return intersection.length >= 2;
}

// LocalStorage Player State Save & Load
function savePlayerState() {
    try {
        localStorage.setItem('claudio_player_state', JSON.stringify({
            queue: queue,
            currentTrackIndex: currentTrackIndex,
            isPlaying: isPlaying,
            currentTime: audioPlayer.currentTime,
            volume: volumeSlider ? volumeSlider.value : 80
        }));
    } catch (e) {
        console.error('[State Saver] Failed to save player state:', e);
    }
}

function loadPlayerState() {
    try {
        const stateStr = localStorage.getItem('claudio_player_state');
        if (!stateStr) return;
        const state = JSON.parse(stateStr);
        if (!state.queue || state.queue.length === 0) return;
        
        queue = state.queue;
        currentTrackIndex = state.currentTrackIndex !== undefined ? state.currentTrackIndex : -1;
        isPlaying = state.isPlaying || false;
        
        if (volumeSlider) {
            volumeSlider.value = state.volume !== undefined ? state.volume : 80;
            const v = volumeSlider.value / 100;
            audioPlayer.volume = v;
            ttsPlayer.volume = v;
        }

        if (currentTrackIndex >= 0 && currentTrackIndex < queue.length) {
            currentTrack = queue[currentTrackIndex];
            currentTrackTitle.innerText = `${currentTrack.name} - ${currentTrack.artist}`;
            playerStatus.innerText = isPlaying ? 'PLAYING' : 'PAUSED';
            updateMoodColor(currentTrack.cover);
            
            audioPlayer.src = currentTrack.url;
            audioPlayer.currentTime = state.currentTime || 0;
            isResumedSession = true;
            updatePlayBtn();
            console.log('[State Loader] Restored player state successfully:', currentTrack.name);
        }
    } catch (e) {
        console.error('[State Loader] Failed to load player state:', e);
    }
}

// Chat History Synchronization
async function restoreChatHistory() {
    try {
        const res = await fetch('/api/history');
        const data = await res.json();
        if (data.success && data.history) {
            console.log(`[History] Restoring ${data.history.length} historical messages...`);
            data.history.forEach(msg => {
                addMessage(msg.role, msg.content, msg.ttsUrl);
            });
        }
    } catch (err) {
        console.error('[History] Failed to restore chat history:', err);
    }
}

// Run Loader & Sync on Page Start
loadPlayerState();
restoreChatHistory();

window.playTTS = playTTS;

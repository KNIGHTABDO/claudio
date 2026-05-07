# 📻 Claudio FM Pro: Neural AI Radio Intelligence

![Claudio FM Pro](https://api.dicebear.com/7.x/bottts/svg?seed=Claudio&backgroundColor=000000)

> **"It's 21:00 in Casablanca, and the airwaves just got a lot smarter."**

Claudio FM Pro is a next-generation, autonomous AI DJ and radio broadcasting system. Unlike traditional players, Claudio is a "Living Radio"—a neural-linked station that combines high-fidelity media streaming with an advanced LLM "Brain" to curate, introduce, and interact with a global audience in real-time.

Built for audiophiles and developers alike, Claudio FM Pro features a stunning, hardware-inspired interface that brings the nostalgia of late-night FM radio into the age of Generative AI.

---

## 🚀 The Core Experience

### 🧠 **Neural DJ Intelligence**
Powered by **Groq (Llama 4 Scout)**, Claudio isn't just a shuffler. He analyzes the current time, weather, and your personal taste to craft sets that make sense. He knows the difference between a "morning wake-up" and a "late-night reflective" vibe.

### 🎙️ **Deepgram Aura TTS**
Claudio speaks with the natural, warm tone of a professional radio host. Using the latest **Aura 2** models, he introduces tracks with deep context, provides smooth segues, and reacts instantly to your requests.

### ⚡ **Zero-Storage Streaming Pipeline**
Claudio uses a high-performance **yt-dlp + ffmpeg** pipe. Music is streamed directly from the cloud into your browser as a 128kbps MP3 stream. **Zero disk space** is used on the server, and the latency is near-zero.

### 🎨 **Pro Console Interface**
A high-fidelity, dual-column "Mission Control" UI designed for Desktop and iPad:
- **Mood Sync**: The entire UI dynamically changes its accent color and neon glow to match the dominant color of the current song's album art.
- **Reactive Visualizer**: A custom-built, interactive equalizer that "dances" in sync with the audio stream.
- **Widescreen Telemetry**: A massive digital clock, "On Air" telemetry, and glassmorphic transmission logs.

---

## 🛠️ Feature Breakdown

### 📻 Broadcasting Controls
- **Smart Interruption**: Ask Claudio to "play something else" and he will instantly kill the current stream, pivot his brain, and launch a new set without missing a beat.
- **Audio Ducking**: Professional radio-style volume ducking. When Claudio speaks, the music volume automatically drops to 20% and smoothly returns to full volume once the transmission ends.
- **Infinite Scrolling**: A "very responsive" layout that adapts from a 2-column Pro console to a mobile-first card layout seamlessly.

### 🧪 Intelligence Systems
- **Taste Learning**: Every "Heart" click is saved to a persistent SQLite database. Claudio learns what you love and adjusts his "Brain" to favor your favorites.
- **Automated Routines**: Every hour, Claudio performs a "Neural Check-in"—he scans the airwaves and automatically updates the vibe if the queue is running low.
- **Hidden Skip Logic**: Clicking "Next" when the queue is empty triggers an autonomous music discovery routine where the AI scans for new frequencies for you.

---

## 📦 Technical Architecture

### **The Stack**
- **Runtime**: Node.js
- **Brain**: Groq API (Llama 4 Scout / 70B Versatile)
- **Voice**: Deepgram Aura (Aura-Asteria-En)
- **Streaming**: yt-dlp & FFmpeg
- **Frontend**: Vanilla JS, Tailwind CSS, Glassmorphism
- **Real-time**: WebSockets (WS)
- **Persistence**: SQLite3

### **Streaming Pipeline Design**
```mermaid
graph LR
    A[YouTube Cloud] --> B[yt-dlp]
    B --> C[FFmpeg MP3 Encoder]
    C --> D[Express Stream API]
    D --> E[Browser Audio Element]
```

---

## ⚙️ Installation & Setup

### **1. Prerequisites**
Ensure you have the following installed on your system:
- **Node.js** (v18+)
- **FFmpeg** (Must be in your system PATH)
- **yt-dlp** (Latest version recommended)

### **2. Clone & Install**
```bash
git clone https://github.com/your-username/claudio-fm.git
cd claudio-fm
npm install
```

### **3. Environment Variables**
Create a `.env` file in the root directory:
```env
# AI Brain
GROQ_API_KEY=your_groq_key
GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct

# Voice (TTS)
DEEPGRAM_API_KEY=your_deepgram_key

# Weather (Context)
OPENWEATHER_API_KEY=your_weather_key

# Station Config
PORT=8080
CITY=Casablanca
```

### **4. Ignition**
```bash
node server.js
```
The station will be ON AIR at `http://localhost:8080`.

---

## 🗺️ Roadmap
- [ ] **Voice Control (STT)**: Integration with Deepgram STT for hands-free DJ interaction.
- [ ] **Cross-Fading**: Implementing dual-channel audio for seamless track transitions.
- [ ] **Ambient Soundbeds**: Adding rainy-day or lo-fi background noise during DJ transmissions.
- [ ] **Multi-Listener Rooms**: Shared WebSocket rooms for synchronized radio parties.

---

## 📜 License
MIT License - Feel free to fork, tweak, and broadcast!

**Built with ❤️ for the future of radio.**

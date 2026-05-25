# 🤝 Contributing to Claudio FM Pro

Thank you for your interest in contributing to **Claudio FM Pro**! As a premium, next-generation neural AI radio broadcasting system, Claudio is designed to represent the pinnacle of autonomous streaming curation and human-like interaction.

This document outlines the standard guidelines, architectural pillars, coding conventions, and workflow instructions required to keep the repository maintainable, high-performing, and clean.

---

## 🗺️ Table of Contents

- [1. Development Vibe & Philosophy](#1-development-vibe--philosophy)
- [2. Setting Up Your Local Environment](#2-setting-up-your-local-environment)
- [3. Core Code Architecture Guidelines](#3-core-code-architecture-guidelines)
  - [3.1. Frontend Architecture (Vanilla JS & Modern CSS)](#31-frontend-architecture-vanilla-js--modern-css)
  - [3.2. Backend Architecture (Express, SQLite, Spawning Streams)](#32-backend-architecture-express-sqlite-spawning-streams)
  - [3.3. WebSocket & State Recovery Dynamics](#33-websocket--state-recovery-dynamics)
- [4. Coding Standards & Quality Guardrails](#4-coding-standards--quality-guardrails)
  - [4.1. Error Recovery Boundaries](#41-error-recovery-boundaries)
  - [4.2. API and Network Call Rules](#42-api-and-network-call-rules)
  - [4.3. Naming Conventions & Code Style](#43-naming-conventions--code-style)
- [5. Git Workflow & Commit Guidelines](#5-git-workflow--commit-guidelines)
  - [5.1. Branch Naming System](#51-branch-naming-system)
  - [5.2. Semantic Commit Message Formats](#52-semantic-commit-message-formats)
  - [5.3. The Pull Request Checklist](#53-the-pull-request-checklist)

---

## 1. Development Vibe & Philosophy

Claudio FM is a "Living Radio" console. It should feel like high-fidelity hardware meets cybernetic intelligence. We maintain three strict rules in our design philosophy:
1. **Never Waste Storage**: No music downloads are saved to the server's disk. Music is a live, flowing dynamic, transcoded on-the-fly and piped from cloud to browser in a zero-storage stream.
2. **Respect the Flow**: A radio broadcast is continuous. Ensure that any backend operations, background cron check-ins, or voice transmissions do not block the active audio player or disrupt listener telemetry.
3. **Be Conversational**: Claudio's personality must remain sophisticated, human-like, and highly concise (typically **1-2 sentences maximum** per transmission). Do not write code that allows the DJ to give lengthy, mechanical, or robotic replies.

---

## 2. Setting Up Your Local Environment

### 2.1. System Prerequisites

Ensure you have the following components installed and verified on your local operating system:

*   **Node.js**: Version `18.0.0` or higher (LTS recommended).
*   **FFmpeg**: Ensure `ffmpeg` and `ffprobe` are present in your system's global `PATH` variable.
    *   *Windows*: Download from a builds site (like gyan.dev), extract, and append the `bin/` folder to user/system Environment Variables.
    *   *macOS*: `brew install ffmpeg`
    *   *Ubuntu/Debian*: `sudo apt-get update && sudo apt-get install -y ffmpeg`
*   **yt-dlp**: Must be globally available. Ensure it is updated frequently to avoid broken cloud scrapers.
    *   *Windows*: Download the latest executable and place it in a folder registered in your `PATH`.
    *   *macOS*: `brew install yt-dlp`
    *   *Ubuntu/Debian*: Follow standard instructions or download from GitHub Releases to `/usr/local/bin/yt-dlp`.

### 2.2. Installation Steps

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/your-username/claudio-fm.git
    cd claudio-fm
    ```

2.  **Install Node Dependencies**:
    ```bash
    npm install
    ```

3.  **Establish Environment Variables**:
    Copy the sample environment template:
    ```bash
    cp .env.example .env
    ```
    Open `.env` and configure your API credentials:
    ```env
    PORT=8080
    CITY=Casablanca
    GROQ_API_KEY=gsk_...
    GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
    DEEPGRAM_API_KEY=...
    OPENWEATHER_API_KEY=...
    JINA_API_KEY=jina_...
    ```

4.  **Verify the Stack**:
    Start the server to verify your installations of SQLite, FFmpeg, and yt-dlp:
    ```bash
    node server.js
    ```
    Navigate to `http://localhost:8080` in your web browser. Click the **Start Console** button to ignite the session.

---

## 3. Core Code Architecture Guidelines

### 3.1. Frontend Architecture (Vanilla JS & Modern CSS)

We purposefully keep the client frontend lightweight, performant, and dependency-free.
*   **No Frameworks**: All DOM manipulations must be implemented in pure Vanilla JS inside `public/app.js`. Do not import React, Vue, Svelte, or Angular.
*   **Visualizer & Audio Nodes**: The equalizer is rendered using CSS keyframes and synced in a glassmorphic frame. Any additions to the audio visualizer or audio controls must work with the core `audioPlayer` and `ttsPlayer` elements without creating blocking states.
*   **Canvas Color Extraction**: The mood-sync component pulls the dominant color of the playing track's thumbnail by loading the cover image onto a 1x1 canvas dynamically. Ensure any custom images have the appropriate `crossOrigin = "Anonymous"` attribute set before attempting rendering to avoid CORS canvas security exceptions.

### 3.2. Backend Architecture (Express, SQLite, Spawning Streams)

Our backend server (`server.js`) utilizes Express for static serving and JSON endpoints, alongside specialized modules in `src/`.
*   **Child Process Spawning**: Streaming is performed in `/api/stream` by spawning `yt-dlp` and `ffmpeg` as sub-processes, piping `ytdlp.stdout` directly into `ffmpeg.stdin`, and `ffmpeg.stdout` into the Express response stream.
    *   *Rule*: Always register process-termination handlers (`req.on('close')`) to kill child sub-processes immediately with `SIGTERM` when a skip or client disconnect occurs, ensuring zero orphaned processes on the server.
*   **SQLite Model Operations**: Database queries are located inside `src/db.js` and use standard promises to bridge callbacks. All new tables must contain appropriate timestamps (`DATETIME DEFAULT CURRENT_TIMESTAMP`) and run inside serialized transactional scopes.

### 3.3. WebSocket & State Recovery Dynamics

Our real-time layer operates over WebSockets (`ws` library).
*   **State Restoring Handshakes**: Upon startup, the client checks `localStorage` for pre-existing player states. It initiates a connection sending `INIT_SESSION` with a `resume: true` or `resume: false` flag. If `resume` is true, the backend skips the DJ startup curation broadcast to prevent interrupting currently playing audio.
*   **Audio Volume Ducking**: When a TTS broadcast arrives via WebSockets, the frontend must smoothly duck the `audioPlayer` volume to 20%, play the `ttsPlayer` to completion, and then restore the `audioPlayer` to 100% volume. Ensure all event listeners (`onended`, `onerror`) are successfully unbound during cleanup phases to prevent event accumulation.

---

## 4. Coding Standards & Quality Guardrails

### 4.1. Error Recovery Boundaries

We design with **graceful degradation** in mind. A single API crash must never take down the radio.

*   **Groq JSON Recovery Boundary**: If the Llama model fails to yield a valid JSON object or throws a `failed_generation` structure, use the recovery system in `src/claude.js` to parse bracket/brace coordinates or perform a secondary rapid formatting completion pass. Always supply a structural, functional fallback JSON object in case of complete API failure.
*   **Jina AI Web Search Fallbacks**: If the web search times out or your Jina quota is exhausted, log the warning and fallback immediately to standard model knowledge.
*   **Weather API Outages**: If OpenWeatherMap is unreachable, default the local weather string to `"Clear, 22°C"` or `"Unknown"` and proceed with normal generation. Do not bubble up exceptions.

### 4.2. API and Network Call Rules

*   **Timeouts**: Never initiate a network fetch without a configured timeout. For Axios, keep standard external lookups (like Jina search) capped at a `15000` ms (15s) timeout threshold to protect responsiveness.
*   **Caching**: All speech generated via Deepgram TTS must be MD5 hashed and stored locally inside `public/tts/`. The janitor schedule in `server.js` automatically cleans up caches older than 3 minutes. Never increase this memory retention unnecessarily.

### 4.3. Naming Conventions & Code Style

We adhere to Clean Code conventions:
*   **Variables**: Use `const` by default. Use `let` only for variables that will be reassigned. Avoid `var` globally. Use `camelCase` for variable, method, and function declarations.
*   **Class/Model Names**: Use `PascalCase` for any class definitions.
*   **Environment Variables**: Always use `UPPER_SNAKE_CASE` for configurations.
*   **Database Columns**: Use `snake_case` in SQLite table definitions (`song_name`, `played_at`).
*   **Spacing & Blocks**: Use 2 spaces for indentation. Never leave dead, un-commented debugging logs (`console.log`) in pull requests.

---

## 5. Git Workflow & Commit Guidelines

### 5.1. Branch Naming System

Create highly descriptive feature branches off our main line:
*   `feature/vibe-control-stt` (For adding new speech-to-text systems)
*   `fix/stream-leak-windows` (For fixing child process stream leaks on Windows)
*   `docs/expand-architecture` (For editing deep architectural logs)
*   `perf/canvas-throttle` (For throttling DOM color sync calls)

### 5.2. Semantic Commit Message Formats

We use semantic commit messages to automatically manage automated versioning and release notes. Your commit messages must match this schema:

```
<type>(<scope>): <short description>

[Optional body detailing rationale]
```

#### Approved Types:
*   `feat`: A brand new user-facing capability.
*   `fix`: A bug fix resolved on the frontend or backend.
*   `docs`: Changes to documentation files, markdown, or inline comments.
*   `style`: Code style modifications (formatting, semi-colons, variable naming) that do not alter execution behavior.
*   `refactor`: Rewriting an existing system to improve quality without changing user-facing results.
*   `perf`: Performance optimizations (e.g. streaming buffers, SQL queries).
*   `test`: Appending automated tests or executing validation runs.

#### Examples:
*   `feat(tts): integrate Deepgram Aura 2 voice engines`
*   `fix(stream): terminate yt-dlp child on browser skip events`
*   `perf(visualizer): switch canvas analysis to offscreen buffers`

### 5.3. The Pull Request Checklist

Before submitting a Pull Request (PR) for review, complete the following checklist to guarantee an immediate merge:

1.  [ ] **Functional Validation**: Run `node server.js` locally and test manual chat inputs, hearts, skips, and volume transitions.
2.  [ ] **Linting & Spacing**: Verify that files are correctly spaced (2 spaces, no trailing carriage returns, no mixed tabs).
3.  [ ] **Orphaned Processes**: Check that skipping multiple tracks in quick succession does not leave background `yt-dlp` or `ffmpeg` processes hanging in the task manager.
4.  [ ] **Schema Conformity**: Ensure any changes to Llama prompt setups or backend interfaces strictly return the exact expected JSON schema.

---

**Happy coding, sir! Let's keep the airwaves smart.**

# Manuscript

Manuscript is a browser-first meeting intelligence platform for Google Meet and uploaded recordings. It records with browser Web Audio APIs, sends audio to a Node.js API, and turns the transcript into four P8-ready outputs:

- A structured executive summary and key discussion topics.
- A decisions log with exact transcript evidence and timestamps.
- Assigned responsibilities with owner, priority, and deadline.
- A global action tracker with Pending, In Progress, and Completed states.

The web dashboard also exports meetings to Notion and Obsidian. There is no Electron app and no native system-audio capture.

The repository contains only the active web dashboard, Chrome extension, Node API, and their tests. The interface uses square corners throughout; circular status dots and loading indicators remain circular for meaning and motion.

## Architecture

- `src/server/` — Express API and WebSocket server on `0.0.0.0:3001`.
- `renderer/` — React + Vite web app on `0.0.0.0:5173`.
- `extension/` — Chrome MV3 extension that records Google Meet tab audio and microphone audio with an offscreen `MediaRecorder`.
- `src/server/providers/` — runtime-neutral STT and LLM provider libraries.
- `.data/` — local server configuration, SQLite database, uploads, and normalized WAV files. It is gitignored.

Audio uploads are normalized to mono 16 kHz WAV with the `ffmpeg` executable installed on the API host. Recording itself is always performed in Chrome.

## Ubuntu setup

Requirements: Node.js 22.12+, pnpm as pinned in `package.json`, and FFmpeg on `PATH`.

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
pnpm install
pnpm run dev
```

Then open `http://<ubuntu-vm-ip>:5173` from the MacBook. The Vite server proxies `/api` to `127.0.0.1:3001`; the extension connects directly to `http://<ubuntu-vm-ip>:3001`.

For an API-only process:

```bash
pnpm start
```

Set `MANUSCRIPT_DATA_DIR=/absolute/path` to move server data, `HOST` to override the bind address, `PORT` to override `3001`, or `FFMPEG_PATH` to point at a nonstandard FFmpeg executable.

## Load the Chrome extension on macOS

1. Build the extension with `pnpm run build:ext` on Ubuntu.
2. Copy or share the `extension/` directory to the MacBook. The zip at `dist/manuscript-extension.zip` is for distribution; Chrome's unpacked loader needs the directory inside it.
3. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
4. Select `extension/` (or the extracted `manuscript-chrome-extension` folder from the zip).
5. Open the extension popup, enter `http://<ubuntu-vm-ip>:3001`, and select **Save & test connection**.
6. Join `https://meet.google.com/...` and use the floating Manuscript control to record, add timestamped notes, and process the meeting.

Chrome may ask for microphone and tab-capture permission. Keep the Ubuntu VM and its API process running while recording.

## Providers and exports

Configure STT (Groq Whisper, Sarvam AI, AssemblyAI, or Google STT), LLM generation (Gemini, Groq, or Claude), Notion, and the Obsidian vault name in Settings. Meetings that mix English and Indic languages can use Sarvam's code-mixed transcription.

The REST surface is documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). API keys are stored locally in `.data/config.json`; protect the API host and do not expose port 3001 to the public internet without authentication and TLS.

## Development

```bash
pnpm run lint
pnpm run test
pnpm run build
node scripts/build-extension.js
```

All source files use LF line endings. Build scripts use `fs.mkdirSync` and `fs.copyFileSync`, not `fs.cpSync`, for UTM shared-folder compatibility.

## License

GPL-3.0-only. See [LICENSE.md](LICENSE.md).

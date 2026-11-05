# Manuscript architecture

## Runtime

```text
Google Meet tab ── Chrome MV3/offscreen MediaRecorder ─┐
Browser recorder / file upload ────────────────────────┼─ POST /api/meetings/upload-audio
                                                       ↓
                     Express API :3001 → FFmpeg normalize → STT → LLM
                                                       ↓
                              sql.js meetings + global actions
                                                       ↓
                           Notion / Obsidian / WebSocket progress

React/Vite dashboard :5173 ── /api proxy ──────────────┘
```

The server binds to `0.0.0.0:3001`; Vite binds to `0.0.0.0:5173` and proxies `/api` to `http://127.0.0.1:3001`. The extension stores an editable backend origin in `chrome.storage.local`, allowing Chrome on macOS to talk to an Ubuntu VM.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Backend connectivity and version. |
| GET | `/api/meetings` | List meetings newest first. |
| GET | `/api/meetings/:id` | Meeting, transcript, structured intelligence, and actions. |
| POST | `/api/meetings/upload-audio` | Multipart `audio` upload plus title, URL, live notes, captions, and start time. |
| GET | `/api/actions` | Global actions; optional `status`, `owner`, and `meetingId` filters. |
| PATCH | `/api/actions/:id` | Update task, owner, priority, deadline, or tracker status. |
| GET/POST | `/api/settings` | Read or update local provider/export settings. |
| GET | `/api/providers` | Serializable provider descriptors. |
| POST | `/api/providers/test` | Test one STT or LLM provider. |
| POST | `/api/export/notion/:meetingId` | Create a Notion page with summary, decision callouts, and to-do blocks. |
| GET | `/api/export/obsidian/:meetingId` | Return Markdown, filename, and `obsidian://new` URI. Add `?download=1` for a file response. |
| WS | `/ws` | Processing and action-update events. |

## Processing pipeline

1. Multer writes WebM, MP3, WAV, M4A, or OGG uploads under `.data/uploads/`.
2. `src/server/audio.js` runs server-side FFmpeg to produce mono 16 kHz PCM WAV. This is format normalization, not audio capture.
3. The selected STT provider returns timestamped speaker segments. Captured Google Meet captions are a fallback when audio transcription fails.
4. The selected LLM receives the transcript and timestamped live notes. The P8 schema requires an executive summary, complete topics, decisions with exact quotes and timestamps, and actions with owners, priority, and deadline.
5. `src/server/database.js` stores the meeting and replaces its rows in the global actions table. Status values are `PENDING`, `IN_PROGRESS`, and `COMPLETED`.
6. Progress events are broadcast over `/ws`. Optional automatic export syncs Notion and prepares the Obsidian deep link.

## Persistence

`sql.js` holds SQLite in memory and rewrites `.data/manuscript.db` on mutation. `.data/config.json` stores settings and credentials. `MANUSCRIPT_DATA_DIR` relocates both. The API should not be exposed publicly without an authenticated reverse proxy and TLS.

## Chrome extension

The Google Meet content script injects a sandboxed extension iframe with recording controls and quick notes. The service worker obtains a `tabCapture` stream ID after the user clicks Start. `offscreen.js` opens the tab stream, attempts microphone access, mixes available tracks through `AudioContext`, records WebM, and uploads it directly to the configured server. A DOM observer captures visible Meet captions as backup evidence.

When processing completes, the overlay offers Notion export, an Obsidian URI, and the web meeting view. Closing a recording tab requests a stop so captured data is not silently discarded.

## Frontend

`renderer/lib/apiClient.js` is the single fetch/WebSocket boundary. `renderer/app.jsx` provides capture/upload, recent meetings, structured meeting detail, exports, settings, and the cross-meeting action Kanban. `renderer/lib/browserRecorder.js` implements optional shared-tab audio plus microphone capture with browser APIs.

## Provider libraries

Provider modules are self-describing CommonJS objects with metadata, credentials, models, `test()`, and either `transcribe()` or `generate()`. They are registered in `src/server/providers/index.js` and are runtime-neutral.

See [ADDING_PROVIDERS.md](ADDING_PROVIDERS.md).

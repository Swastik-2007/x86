# Manuscript architecture

## Runtime

```text
Google Meet tab ── Chrome MV3/offscreen MediaRecorder ─┐
Meet captions / browser upload ────────────────────────┼─ Express API :3001
                                                       ↓
   FFmpeg normalize → Local/cloud STT → caption/name merge → Local/cloud LLM
                                                       ↓
                sql.js meetings + actions + schedules + local settings
                                                       ↓
                 Notion / Obsidian / Calendar / WebSocket progress

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
| POST | `/api/meetings/from-captions` | Process named Meet captions without an audio upload. |
| PATCH | `/api/meetings/:id/rename-speaker` | Atomically rename a speaker through transcript, structured notes, captions, and actions. |
| GET/POST | `/api/actions` | Filter or create actions; filters include `status`, `owner`, `priority`, and `meetingId`. |
| PATCH | `/api/actions/:id` | Update task, owner, priority, deadline, or tracker status. |
| DELETE | `/api/actions/:id` | Delete an action. |
| GET | `/api/actions/:id/calendar` | Return a Google Calendar link or `?download=1` action-deadline ICS. |
| GET/POST/PATCH/DELETE | `/api/calendar[/:id]` | Scheduled meeting CRUD. |
| GET | `/api/calendar/:id/export` | Return a Google Calendar link or `?download=1` scheduled-meeting ICS. |
| GET/POST | `/api/settings` | Read or update local provider/export settings. |
| POST | `/api/local-ai/test` | Probe Python Whisper and LM Studio from the Ubuntu backend. |
| GET | `/api/providers` | Serializable provider descriptors. |
| POST | `/api/providers/test` | Test one STT or LLM provider. |
| POST | `/api/export/notion/:meetingId` | Create a Notion page with summary, decision callouts, and to-do blocks. |
| GET | `/api/export/obsidian/:meetingId` | Return Markdown, filename, and `obsidian://new` URI. Add `?download=1` for a file response. |
| WS | `/ws` | Processing and action-update events. |

## Processing pipeline

1. Multer writes WebM, MP3, WAV, M4A, or OGG uploads under `.data/uploads/`.
2. `src/server/audio.js` runs server-side FFmpeg to produce mono 16 kHz PCM WAV. This is format normalization, not audio capture.
3. The selected STT provider returns timestamped speaker segments. Local Python Whisper tries the configured endpoint and supported multipart paths; named Meet captions can be the only transcript or a hybrid name/evidence source.
4. The selected LLM receives the transcript and timestamped live notes. LM Studio uses its OpenAI-compatible chat endpoint. The JSON extractor accepts fenced/conversational output, repairs common local-model syntax, and requests one repair completion when needed.
5. The P8 schema requires an executive summary, complete topics, decisions with exact quotes and timestamps, and actions with owners, priority, deadline, and optional source evidence.
6. `src/server/database.js` stores meetings, global actions, schedules, and non-secret local/profile settings. Action status values are `PENDING`, `IN_PROGRESS`, `BLOCKED`, and `COMPLETED`.
7. Progress and mutation events are broadcast over `/ws`. Optional automatic export syncs Notion and prepares the Obsidian deep link.

## Persistence

`sql.js` holds SQLite in memory and rewrites `.data/manuscript.db` on mutation. Local service URLs/model IDs, profile names, and schedules live in SQLite; `.data/config.json` stores provider/export credentials. `MANUSCRIPT_DATA_DIR` relocates both. The API should not be exposed publicly without an authenticated reverse proxy and TLS.

## Chrome extension

The Google Meet content script injects a sandboxed extension iframe with recording controls, timestamped notes, and decision flags. The service worker obtains a `tabCapture` stream ID after the user clicks Start. `offscreen.js` opens the tab stream, attempts microphone access, mixes available tracks through `AudioContext`, records WebM, and uploads it directly to the configured server. DOM observers capture visible participant names and Meet captions as backup evidence.

The Calendar page can open a Meet URL with title, participant, and agenda context in the URL fragment. The content script consumes this context, removes the fragment from the stored meeting URL, and primes the overlay; capture still requires an explicit extension-origin click. A minimal HTTP content script only answers the dashboard's installation ping. When processing completes, the overlay offers Notion, Obsidian, and Action Tracker actions. Closing a recording tab requests a stop so captured data is not silently discarded.

## Frontend

`renderer/lib/apiClient.js` is the single fetch/WebSocket boundary. `renderer/app.jsx` provides capture/upload, meeting detail and speaker rename, rich exports, a four-column action Kanban, month/week scheduling, settings, and live setup guidance. `renderer/lib/browserRecorder.js` implements optional shared-tab audio plus microphone capture with browser APIs.

## Provider libraries

Provider modules are self-describing CommonJS objects with metadata, credentials, models, `test()`, and either `transcribe()` or `generate()`. They are registered in `src/server/providers/index.js` and are runtime-neutral.

See [ADDING_PROVIDERS.md](ADDING_PROVIDERS.md).

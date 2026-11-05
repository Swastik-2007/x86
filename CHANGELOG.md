# Changelog

## [7.0.0] - 2026-11-05

### Added

- First-class MacBook Local AI support for Python Whisper multipart endpoints and LM Studio OpenAI-compatible LFM models, including SQLite settings, connection checks, caption-only input, and resilient local-model JSON recovery.
- Real-name participant hints, atomic speaker rename propagation, and named transcript review across meetings, decisions, attendees, captions, notes, and action owners.
- Four-column Action & Decision Tracker with Blocked status, source evidence, filters, reassignment, standalone actions, exports, and action-deadline calendar links.
- Calendar & Schedule page with month/week views, meeting CRUD, agenda and participants, Google Calendar links, ICS downloads, and Google Meet extension context priming.
- How It Works page with live media/API/Local AI/extension/export checks, guided fixes, a button dictionary, contextual tooltips, and toast feedback.

### Changed

- Upgraded the Google Meet extension with participant/caption scraping, draggable recording controls, decision flags, per-recording export preferences, completion actions, and scheduled-meeting context.
- Enriched Notion and Obsidian output with meeting metadata, named transcripts, decision callouts, assigned tasks, participant frontmatter, app links, and clean Markdown downloads.
- Kept all web and extension controls square-cornered and expanded the server API/database for local settings, action evidence, and scheduled meetings.

### Fixed

- Prevented conversational, fenced, trailing-comma, and partially emitted JSON from smaller local LLMs from breaking meeting processing.
- Preserved existing action records during the SQLite schema upgrade and kept VM-to-Mac service URLs out of browser bundles.

## [6.0.2] - 2026-11-05

### Changed

- Replaced rounded interface corners with square geometry across the web dashboard, Chrome extension, and static site.
- Reduced the repository to the active browser, extension, and Node API code paths and removed unused dependencies.
- Updated the package-manager pin to the signed pnpm 12.16.1 release.

### Removed

- Deleted the retired Electron runtime, native desktop capture and packaging code, desktop-only tests, stale renderer components, obsolete assets, and unused extension launch-protocol files.

## [6.0.1] - 2026-11-05

### Fixed

- Prevented Vite's API proxy from intercepting the browser API-client module, which left the Ubuntu-hosted web app on a blank white screen.
- Made the combined development launcher start Node and Vite directly on Windows and Linux instead of failing through a platform-specific pnpm child process.

## [6.0.0] - 2026-11-05

### Added

- Express/WebSocket API on port 3001 with meeting, audio-upload, action-tracker, settings, provider-test, Notion, and Obsidian routes.
- Browser dashboard recording and audio upload, evidence-backed decision views, global drag/toggle action tracker, and one-click Notion/Obsidian exports.
- Chrome MV3 Google Meet tab-and-microphone capture through an offscreen MediaRecorder, timestamped live notes, caption fallback, and configurable backend URL.

### Changed

- Replaced the Electron desktop runtime with a browser-first React/Vite frontend and Node.js server, including server-side FFmpeg upload normalization and sql.js persistence.
- Updated the meeting intelligence schema to emphasize structured summaries, exact decision quotes and timestamps, assigned owners, priorities, deadlines, and tracker status.

### Removed

- Electron, electron-builder, electron-store, electron-updater, koffi, fluent-ffmpeg, desktop packaging scripts, and native OS audio-capture dependencies.

## [5.0.0] - 2026-11-05

### Added

- Decision & Action Intelligence badge in the top bar, Dashboard setup/empty states and the Settings header.
- Plain-browser fallback: the Vite dev renderer now boots as a read-only empty view when `window.meetmind` is missing (`renderer/lib/browserBridge.js`), so a host browser tab can open the dev server safely.

### Changed

- Rebranded the app from MeetMind to Manuscript: package metadata (`name`, `description`, `desktopName`), build config (`appId com.manuscript.app`, `productName`, installer shortcut names, Windows exe metadata), window/tray/overlay titles, launch-at-login entries, extension manifest and popup, provider copy, and the default LLM system prompts ("You are Manuscript…"). Extension zip output is now `dist/manuscript-extension.zip`.
- Refreshed the visual accent: indigo (#6366f1 light / #818cf8 dark) primary with crisp slate surfaces (light `#f8fafc`, dark `#0f172a`), matching tokens, splash, PDF document, and Chrome extension surfaces; DESIGN.md updated to the new style reference.
- Exposed the Vite dev server on `0.0.0.0:5173` with a strict port and CORS open for host-machine access; Electron still boots from `http://localhost:5173`.

### Fixed

- White screen after the splash when the renderer runs in a plain browser tab: `window.meetmind.capture.onStart` threw because the browser fallback bridge's `capture` namespace wasn't callable through nested property access; the bridge is now a recursive null-safe proxy (`renderer/lib/browserBridge.js`).
- `pnpm run dev` / `dev:electron` no longer crash on Linux shells without `DISPLAY` (e.g. VS Code terminals in a Wayland session): `scripts/dev-electron.js` auto-detects the session's XWayland display from `/tmp/.X11-unix`, falls back to `xvfb-run` in headless VMs, and otherwise prints an actionable message.
- Extension packaging staging directory renamed to `manuscript-chrome-extension` alongside the zip output.

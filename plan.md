# Manuscript 7.0 implementation plan

All tasks are executed sequentially. Each completed checkbox receives verification notes before work begins on the next checkbox.

## Task 1 — Local AI pipeline

- [x] 1.1 Add persisted local Whisper and LM Studio settings, provider descriptors, and backend connection tests.
  - Evaluation: Added SQLite-backed local endpoint/model settings, effective config merging, `/api/local-ai/test`, and reusable timeout-safe probes in `src/server/local-ai.js`. Focused tests pass (2/2), including separate secret/local persistence routing and both network probes.
- [x] 1.2 Add a local Whisper multipart transcription provider supporting `/v1/audio/transcriptions`, `/inference`, and `/transcribe`, plus caption fallback/hybrid input.
  - Evaluation: Registered `local-whisper`, added multipart endpoint fallback and flexible segment parsing, caption-only processing at `/api/meetings/from-captions`, and timestamp-based caption name merging. Focused Local AI tests pass (4/4), including endpoint and hybrid-speaker coverage.
- [x] 1.3 Add an LM Studio OpenAI-compatible LLM provider and resilient fenced/conversational JSON extraction with a retry repair pass.
  - Evaluation: Registered `lm-studio`, normalized OpenAI-compatible chat URLs, added balanced/fenced JSON extraction with partial/trailing-comma recovery, and implemented a second LM repair completion when the first response is invalid. Focused tests pass (6/6), including conversational fenced JSON and the retry path.
- [x] 1.4 Add Local AI controls and a combined “Test Local AI Models” action to Web Settings.
  - Evaluation: Added editable Whisper URL/model and LM Studio base URL/model fields, a combined connection action, per-service connected/unavailable badges, and UTM network guidance. The production renderer build succeeds.
- [x] 1.5 Verify Task 1 with focused tests, lint, and renderer build; record evaluation.
  - Evaluation: Task 1 passes ESLint, all 10 active Vitest tests across 4 files, and the Vite production build. Local endpoints remain configurable without placing local network details or API keys in browser bundles.

## Task 2 — Speaker identity and real-name mapping

- [x] 2.1 Add persisted user profile/default participant settings and expose them in Web Settings.
  - Evaluation: Added SQLite-backed `userName` and `defaultParticipants` settings plus a clear profile card with comma-separated teammate editing. Focused persistence tests (6/6) and the renderer production build pass.
- [x] 2.2 Add speaker rename database logic and `PATCH /api/meetings/:id/rename-speaker` to update transcript, decisions, attendees, and actions atomically.
  - Evaluation: Added transactional rename propagation for transcript/captions/live notes/structured decisions and attendees, plus exact-owner updates in actions and a broadcast API endpoint. Focused nested-reference tests pass (2/2), including label-boundary safety.
- [x] 2.3 Add a Meeting Details speaker roster with rename controls and refresh behavior.
  - Evaluation: Added a square-corner speaker roster, profile-backed name suggestions, save/cancel rename flow, success feedback, refresh behavior, and a named timestamped transcript section. The production renderer build succeeds.
- [x] 2.4 Enhance Meet participant/caption extraction so the extension supplies real names and participant hints.
  - Evaluation: Added broader Meet participant and caption DOM discovery, speaker-aware caption deduplication, participant hint transport through background/offscreen upload, and generic-audio-speaker mapping from collected names. ESLint and extension packaging pass; final DOM behavior still requires the specified manual Meet exercise in Chrome.
- [x] 2.5 Verify Task 2 with focused tests, lint, and renderer build; record evaluation.
  - Evaluation: Task 2 passes ESLint, all 12 active tests across 5 files, and the Vite production build. Rename propagation is unit-covered; the Meet DOM selectors are packaged and await the required manual live-Meet exercise.

## Task 3 — Chrome extension capture and VM sync

- [x] 3.1 Upgrade popup backend configuration, live status, and Notion/Obsidian auto-export toggles.
  - Evaluation: Expanded the popup with an explicit Ubuntu VM URL, live backend indicator, network guidance, and persistent Notion/Obsidian toggles. Extension packaging succeeds with square-corner controls.
- [x] 3.2 Upgrade the draggable in-call overlay for start/stop, caption backup, timed quick notes, and decision flags.
  - Evaluation: Added iframe drag messaging with bounds, explicit tab+microphone labeling, automatic-caption guidance, timestamped notes, a decision flag action, and the existing stop/process flow. ESLint and extension packaging pass.
- [x] 3.3 Ensure offscreen/background upload sends audio, named captions, participant hints, notes, and export preferences to the Ubuntu backend.
  - Evaluation: The background now snapshots export preferences at recording start; offscreen upload includes audio, notes, captions, participant hints, and preferences; the server honors per-recording Notion sync. ESLint and extension packaging pass.
- [x] 3.4 Add the completion card actions for Notion, Obsidian, and the Action Tracker.
  - Evaluation: Completion now presents clearly labeled Sync to Notion, Open in Obsidian, and Open Action Tracker buttons. The new tracker deep link opens the web app directly in its action view; extension packaging succeeds.
- [x] 3.5 Verify Task 3 with lint and extension build; document the manual Chrome exercise requirement.
  - Evaluation: ESLint and `node scripts/build-extension.js` pass. Added `docs/EXTENSION_TEST.md` with the required Chrome/Google Meet start, notes, captions, stop, upload, rename, and export exercise; it cannot be executed from this Windows workspace against the user’s MacBook Meet session.

## Task 4 — Notion and Obsidian exports

- [x] 4.1 Upgrade Notion export with metadata, decision callouts, actionable to-dos, and a collapsible named transcript.
  - Evaluation: Notion pages now include date/participant/link metadata, executive summary, decision callouts, interactive assigned to-dos, and a named timestamped transcript toggle. Export formatting tests pass (2/2).
- [x] 4.2 Upgrade Obsidian Markdown frontmatter, summary/decision callouts, owner/deadline tasks, app URI, and direct download.
  - Evaluation: Obsidian notes now emit `participants` and required tags in YAML, summary/decision callouts, owner tasks with calendar deadlines, a named transcript, the `obsidian://new` URI, and the existing clean Markdown download response. Export tests pass (2/2).
- [x] 4.3 Add distinct Web UI actions for opening Obsidian and downloading the Markdown file, with feedback.
  - Evaluation: Added distinct, tooltip-backed Open in Obsidian App and Download `.md` for Vault actions with success feedback. The renderer production build succeeds.
- [x] 4.4 Verify Task 4 with focused export tests, lint, and renderer build; record evaluation.
  - Evaluation: Task 4 passes ESLint, all 13 active Vitest tests, and the Vite production build. Export-specific assertions cover both Notion and Obsidian structure.

## Task 5 — Global Action & Decision Tracker

- [x] 5.1 Extend actions for Blocked status, source quote/timestamp, owner reassignment, and standalone action creation.
  - Evaluation: Added a data-preserving actions migration, nullable standalone records, Blocked ordering, source quote/timestamp fields, reassignment support, and normalized action creation. Focused action record tests pass (2/2).
- [x] 5.2 Add action CRUD/filter API support and export/calendar helpers.
  - Evaluation: Added create/update/delete and status/owner/priority/meeting filter APIs, renderer client methods, meeting-backed Notion/Obsidian action exports, and Google/ICS deadline helpers. Focused tests pass (3/3) and ESLint succeeds.
- [x] 5.3 Build the four-column Kanban with assignee/priority/meeting filters and rich source context.
  - Evaluation: Rebuilt the tracker as Pending/In Progress/Blocked/Completed columns with drag support, three filters, owner initials, deadline/priority, linked source meeting, and exact transcript evidence. ESLint and renderer build pass.
- [x] 5.4 Add the “Assign New Action” dialog and quick status/owner/export controls.
  - Evaluation: Added an accessible square-corner assignment dialog for standalone or meeting-linked work, plus inline owner/status changes and Notion, Obsidian, Google Calendar, and ICS actions with feedback.
- [x] 5.5 Verify Task 5 with focused tests, lint, and renderer build; record evaluation.
  - Evaluation: Task 5 passes all 16 Vitest tests across 6 files, ESLint, and the Vite production build. The action migration preserves existing meeting-linked records while enabling standalone work.

## Task 6 — Calendar and scheduler

- [x] 6.1 Add the `scheduled_meetings` table and calendar CRUD API.
  - Evaluation: Added the indexed SQLite schedule table, JSON participant hydration, validated list/create/read/update/delete endpoints, WebSocket refresh events, and renderer client methods. Focused scheduler tests pass (2/2).
- [x] 6.2 Add Google Calendar links and downloadable ICS for meetings and action deadlines.
  - Evaluation: Added reusable event/Google URL/ICS generation, scheduled-meeting and action-deadline export endpoints, portable downloads, and client helpers. Six focused calendar/action tests pass.
- [x] 6.3 Build monthly/weekly calendar views, agenda, scheduling editor, and participant/agenda fields.
  - Evaluation: Added Calendar navigation, 42-day month and 7-day week views, clickable dates, upcoming agenda, create/edit/delete schedule form, participant/agenda fields, and Google/ICS controls. ESLint and renderer build pass.
- [x] 6.4 Add Join & Auto-Record behavior that opens Meet and primes extension context.
  - Evaluation: Added a scheduled-meeting launch action that opens Google Meet with encoded context; the extension preloads title, participant hints, and agenda, strips launch metadata before upload, and shows primed context before the user-authorized capture click. Lint, renderer build, and extension packaging pass.
- [x] 6.5 Verify Task 6 with focused tests, lint, and renderer build; record evaluation.
  - Evaluation: Task 6 passes all 19 Vitest tests across 7 files, ESLint, the Vite production build, and extension packaging. Live Chrome tab-capture authorization remains part of the documented manual Meet exercise.

## Task 7 — UX overhaul and setup guide

- [x] 7.1 Add the How It Works navigation page with four visual workflow steps.
  - Evaluation: Added a clearly labeled top-level help destination and four numbered visual cards covering Local AI, extension setup, capture/speaker naming, and action/calendar/export workflow. The renderer production build succeeds.
- [x] 7.2 Add live permission/connection checks and Fix/Grant actions for media, API, Local AI, extension, Notion, and Obsidian.
  - Evaluation: Added live backend, Whisper, LM Studio, media-permission, extension-installation, Notion, and Obsidian checks with Grant/Fix/Retry actions. A minimal HTTP extension bridge reports installation without exposing meeting data. Lint, renderer build, and extension packaging pass.
- [x] 7.3 Add the button dictionary and improve labels, tooltips, helper copy, step indicators, and toast feedback throughout the app.
  - Evaluation: Added the six-action button dictionary, explicit capture/helper labels, tooltips on contextual controls, numbered steps, accessible status regions, and transient success toasts across capture, rename, export, tracker, calendar, and settings flows. Lint and renderer build pass.
- [x] 7.4 Update version/changelog and all user-facing architecture/setup documentation; search for stale wording.
  - Evaluation: Bumped package and extension to 7.0.0, added the 2026-11-05 release notes, and updated README, architecture, provider, known-issue, extension-test, LLM-index, and static-site copy. Stale status/version/Electron wording searches are clean, all UI border radii are removed, build-copy code remains shared-folder safe, and source/doc line endings are LF.
- [x] 7.5 Run final lint, tests, renderer build, full build, and `node scripts/build-extension.js`; confirm all plan items are complete.
  - Evaluation: Final ESLint passes without warnings; all 19 tests across 7 files pass; renderer and full production builds succeed; explicit extension packaging succeeds; `git diff --check` is clean; and a temporary runtime database smoke test created/read meetings, Blocked actions, and schedules successfully. Every plan checkbox is complete.

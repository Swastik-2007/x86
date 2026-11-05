# Repository instructions

## Runtime architecture

Manuscript has three browser/server artifacts:

- `src/server/`: Express REST API and WebSocket progress service on `0.0.0.0:3001`.
- `renderer/`: React/Vite web app on `0.0.0.0:5173`; `/api` proxies to `127.0.0.1:3001`.
- `extension/`: Chrome MV3 Google Meet extension. Its service worker requests `tabCapture`, an offscreen document mixes tab audio and microphone audio with Web Audio, and `MediaRecorder` uploads WebM to the configured backend URL.

Provider libraries live in `src/server/providers/` and pure note helpers in `src/server/notes/`. They must remain Node-compatible and browser-runtime independent.

Do not add Electron, desktop windows, trays, auto-updaters, native OS audio capture, WASAPI, PulseAudio capture, BlackHole, or CoreAudio capture. FFmpeg is server-side normalization only.

## Versioning and changelog

For functional changes, bump `package.json` using semantic versioning and add the matching newest `## [X.Y.Z] - YYYY-MM-DD` section to `CHANGELOG.md` using Added, Changed, Fixed, or Removed headings. Skip only comments, formatting, whitespace, and internal documentation.

Update all user-facing documentation when behavior, providers, settings, routes, architecture, or commands change. Search for stale wording with `rg -i`.

## Files and shared folders

Use LF line endings for every source and script. UTM shared folders can reject `fs.cpSync`; recursive build copies must use `fs.mkdirSync(..., { recursive: true })` and `fs.copyFileSync`.

Use pnpm only. Keep `minimumReleaseAge: 1440` and `verifyDepsBeforeRun: warn` in `pnpm-workspace.yaml`.

## Commands

- `pnpm install` — install dependencies.
- `pnpm run dev` — start API and Vite servers together.
- `pnpm run dev:server` — API only on port 3001.
- `pnpm run dev:renderer` — Vite only on port 5173.
- `pnpm run build` — build the web renderer and extension.
- `pnpm run build:ext` — create `dist/manuscript-extension.zip`.
- `pnpm run lint` — lint the active web, server, extension, provider, and test code.
- `pnpm run test` — run Vitest tests in `tests/web/`.

Run lint, tests, the renderer build, and `node scripts/build-extension.js` before finishing functional work. For capture changes, also load the unpacked extension in Chrome and exercise start, notes, captions, stop, upload, and export.

## UI work

Read `DESIGN.md` in full before editing anything rendered on screen. Use its DM Sans, slate, indigo, emerald, hairline-border, radius, and zero-shadow rules. Prefer CSS variables and accessible native controls.

## Security

API keys live in `.data/config.json`. Never commit `.data/`, real secrets, recordings, or generated databases. The development API has permissive CORS for the extension and LAN demo; document that it must be placed behind authentication and TLS before public exposure.

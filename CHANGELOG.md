# Changelog

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

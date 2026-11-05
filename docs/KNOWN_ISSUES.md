# Known issues

- Chrome tab capture must be initiated by an explicit user click in the Google Meet overlay.
- Chrome or macOS may deny microphone access to an extension offscreen document. Manuscript continues with tab audio when available.
- Visible Google Meet captions are best-effort backup evidence because Meet's DOM is not a public API and can change.
- The API uses permissive development CORS and has no built-in user authentication. Keep it on a trusted LAN for demos or place it behind an authenticated TLS reverse proxy.
- Obsidian deep links open the vault on the MacBook running the browser; the Ubuntu API cannot write directly into that Mac vault.
- FFmpeg must be installed on the API host and reachable through `PATH` or `FFMPEG_PATH`.

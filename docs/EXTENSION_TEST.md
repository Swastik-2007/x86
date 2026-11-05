# Chrome extension manual verification

Automated lint and packaging cannot validate Google Meet’s live DOM, `tabCapture`, or macOS permission prompts. Before a release that changes capture behavior, run this check in Chrome on the MacBook:

1. Build with `pnpm run build:ext`, extract `dist/manuscript-extension.zip`, and load the unpacked `manuscript-chrome-extension` folder at `chrome://extensions`.
2. In the popup, enter the Ubuntu VM API URL, enable the desired export toggles, and confirm the green backend indicator.
3. Join a test Google Meet with at least two named participants and enable Meet captions.
4. Drag the Manuscript control, start recording, grant microphone/tab-audio access, add a quick note, and flag a decision.
5. Confirm named captions appear during the call, then select **Stop & process**.
6. Verify the completion card can sync Notion, open Obsidian, and open the Action Tracker.
7. In the web meeting detail, verify audio/captions uploaded, names are present, rename propagation works, and the transcript/decisions/actions agree.
8. Schedule another test session in the Calendar with participant names and an agenda. Select **Join & Auto-Record**, confirm the Meet overlay shows the primed title/participants, and verify the agenda arrives as a timestamp-zero live note after recording.
9. Open **How It Works** in the dashboard and confirm the Chrome extension check reports Connected after reloading the unpacked extension.

Never run this test with confidential meetings or production credentials.

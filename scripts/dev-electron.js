/**
 * Spawns Electron for `pnpm run dev` / `pnpm run dev:electron` with a safe Linux display fallback.
 *
 * The desktop session here may run Wayland with XWayland (Electron uses the
 * `ozone-platform=x11` path through XWayland; see electron/main.js). A terminal spawned
 * directly from the Wayland session — e.g. a VS Code terminal — often has no DISPLAY in its
 * environment, which makes Electron exit with:
 *   "ERROR:ozone_platform_x11 Missing X server or $DISPLAY".
 *
 * Fallback order on Linux when DISPLAY is unset:
 *   1. An existing X display socket in /tmp/.X11-unix (the session's XWayland, usually :0)
 *   2. `xvfb-run -a` (headless VMs), when Xvfb is installed
 *   3. Otherwise exit with an actionable message.
 *
 * Windows and macOS spawn Electron directly, as before.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ELECTRON = require(path.join(ROOT, 'node_modules', 'electron'));

function findExistingXDisplay() {
  try {
    const sockets = fs.readdirSync('/tmp/.X11-unix').filter((n) => /^X\d+$/.test(n));
    if (sockets.length > 0) return ':' + sockets[0].slice(1);
  } catch {
    // No sockets directory (pure Wayland without XWayland, or container).
  }
  return null;
}

function hasXvfbRun() {
  try {
    const { execSync } = require('child_process');
    execSync('command -v xvfb-run', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const env = { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' };

if (process.platform === 'linux' && !env.DISPLAY) {
  const display = findExistingXDisplay();
  if (display) {
    env.DISPLAY = display;
    console.log(`[dev-electron] DISPLAY was unset in this shell; using existing X display ${display}`);
  } else if (hasXvfbRun()) {
    console.log('[dev-electron] No X display, running Electron inside Xvfb');
    spawn('xvfb-run', ['-a', ELECTRON, '.'], { env, stdio: 'inherit' }).on('exit', (code) => process.exit(code));
  } else {
    console.error(
      '[dev-electron] No X display found and Xvfb is not installed.\n' +
      '  Install a virtual display with:  sudo apt-get install -y xvfb\n' +
      '  (on a desktop machine, log into a session that provides X11 or XWayland).'
    );
    process.exit(1);
  }
}

const child = spawn(ELECTRON, ['.'], { env, stdio: 'inherit' });
child.on('exit', (code, signal) => {
  if (signal) process.exit(0);
  process.exit(code ?? 1);
});

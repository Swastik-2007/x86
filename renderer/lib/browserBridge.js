/**
 * Plain-browser fallback for the Electron preload bridge.
 *
 * When the renderer is served straight into a normal browser tab (e.g. the Vite dev server hit
 * from a host machine's browser at http://<vm-ip>:5173), there is no preload script, so
 * `window.meetmind` is undefined. app.jsx already guards its core effects
 * (`if (!window.meetmind) return;`), which keeps the shell rendering as an empty read-only view —
 * but any stray unguarded call (window buttons, Settings actions, event subscriptions) would
 * throw "Cannot read properties of undefined" and white-screen the tab.
 *
 * This shim installs a quiet no-op stub so those calls can't throw. It does nothing in the real
 * Electron window: it bails immediately when the preload bridge already exists.
 */

const unsubscribe = () => () => {};
const noopVoid = () => {};
const noopAsync = () => Promise.resolve();

// The members the renderer touches most, with shapes that keep callers happy:
// event subscriptions return an unsubscribe function, lists resolve to arrays,
// and reads resolve to empty objects instead of undefined so `cfg?.key` style
// access stays safe.
const stub = {
  platform: 'browser',
  on: unsubscribe,
  window: { wasShown: () => false, minimize: noopVoid, maximize: noopVoid, close: noopVoid },
  config: {
    get: () => Promise.resolve({}),
    set: noopAsync,
    setMultiple: () => Promise.resolve({}),
  },
  sessions: {
    list: () => Promise.resolve([]),
    get: () => Promise.resolve(undefined),
    revision: () => Promise.resolve(0),
    delete: noopAsync,
  },
  providers: { list: () => Promise.resolve([]) },
  updater: { getStatus: () => Promise.resolve(undefined) },
};

export const browserBridge = new Proxy(stub, {
  // Anything not enumerated silently no-ops as an async function, which covers
  // actions (start/stop recording, Notion, ffmpeg…) that await nothing useful here.
  get(target, prop) {
    if (prop in target) return target[prop];
    return noopAsync;
  },
});

/** Installs the stub once, only where the real bridge is missing. */
export function installBrowserBridge() {
  if (typeof window === 'undefined' || window.meetmind) return;
  window.meetmind = browserBridge;
}

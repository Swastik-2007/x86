/**
 * Plain-browser fallback for the Electron preload bridge.
 *
 * When the renderer is served straight into a normal browser tab (e.g. the Vite dev server hit
 * from a host machine's browser at http://<vm-ip>:5173), there is no preload script, so
 * `window.meetmind` is undefined. App code varies between early guards (`if (!window.meetmind)
 * return;`) and direct nested calls (`window.meetmind.capture.onStart(...)` in a useEffect), so a
 * stub must survive both: every property access returns another callable node, methods resolve to
 * sensible empty values when called or awaited, and every node is safe to await or stringify.
 *
 * This shim installs that stub so none of those paths can throw and white-screen a plain tab.
 * It does nothing in the real Electron window: it bails immediately when the preload bridge
 * already exists.
 */

const unsubscribe = () => () => {};

/** A null-ish value for every type test: '' when stringified, undefined when awaited or called. */
function nullishNode() {
  const fn = () => Promise.resolve(undefined);
  return new Proxy(fn, {
    get(_target, prop) {
      if (prop === 'then') return (resolve) => resolve(undefined); // await → undefined
      if (prop === Symbol.toPrimitive) return () => ''; // string coercion → '' (falsy)
      if (prop === Symbol.iterator) return () => { return { done: true, value: undefined }; };
      if (String(prop).startsWith('on')) return unsubscribe; // event subscriptions
      return nullishNode(); // keep chaining through any depth
    },
    apply() {
      return Promise.resolve(undefined);
    },
  });
}

// The members the renderer touches most, with shapes that keep callers meaningful:
// event subscriptions return an unsubscribe function, lists resolve to arrays,
// and reads resolve to empty objects instead of undefined so object-style access
// (`cfg?.key`, `session?.id`) stays null-safe while staying falsy when unset.
const real = {
  platform: 'browser',
  on: unsubscribe,
  window: { wasShown: () => false, minimize: unsubscribe, maximize: unsubscribe, close: unsubscribe },
  config: {
    get: () => Promise.resolve({}),
    set: () => Promise.resolve(undefined),
    setMultiple: () => Promise.resolve({}),
  },
  sessions: {
    list: () => Promise.resolve([]),
    get: () => Promise.resolve(undefined),
    revision: () => Promise.resolve(0),
    delete: () => Promise.resolve(undefined),
  },
  providers: { list: () => Promise.resolve([]) },
  updater: { getStatus: () => Promise.resolve(undefined) },
};

const bridge = new Proxy(real, {
  get(target, prop) {
    if (prop in target) return target[prop];
    return nullishNode(); // unknown namespaces/methods stay safe at any depth
  },
});

/** Installs the stub once, only where the real bridge is missing. */
export function installBrowserBridge() {
  if (typeof window === 'undefined' || window.meetmind) return;
  window.meetmind = bridge;
}

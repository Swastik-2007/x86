window.addEventListener('message', (event) => {
  if (event.source !== window || event.data?.type !== 'MANUSCRIPT_EXTENSION_PING') return;
  window.postMessage({ type: 'MANUSCRIPT_EXTENSION_PONG', version: chrome.runtime.getManifest().version }, '*');
});

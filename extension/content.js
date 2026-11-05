let overlayFrame = null;
const seenCaptions = new Set();

function injectOverlay() {
  if (overlayFrame || !location.href.startsWith('https://meet.google.com/')) return;
  overlayFrame = document.createElement('iframe');
  overlayFrame.src = chrome.runtime.getURL('overlay/overlay.html');
  overlayFrame.title = 'Manuscript meeting controls';
  Object.assign(overlayFrame.style, { position: 'fixed', right: '24px', bottom: '88px', width: '380px', height: '240px', zIndex: '2147483647', border: '0', background: 'transparent' });
  document.documentElement.appendChild(overlayFrame);
}

function send(message, callback) {
  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) callback?.({ success: false, error: chrome.runtime.lastError.message });
    else callback?.(response);
  });
}

window.addEventListener('message', (event) => {
  if (event.source !== overlayFrame?.contentWindow || !event.data?.type) return;
  const message = event.data;
  if (message.type === 'START_RECORDING') send({ type: 'START_RECORDING', meetingUrl: location.href, meetingTitle: document.title }, (response) => overlayFrame.contentWindow.postMessage({ type: response?.success ? 'RECORDING_STARTED' : 'PROCESSING_ERROR', error: response?.error }, '*'));
  if (message.type === 'STOP_RECORDING') send({ type: 'STOP_RECORDING' });
  if (message.type === 'LIVE_NOTE') send({ type: 'LIVE_NOTE', text: message.text, timestamp: message.timestamp });
  if (message.type === 'EXPORT_NOTION') send({ type: 'EXPORT_NOTION', meetingId: message.meetingId }, (response) => { if (response?.url) window.open(response.url, '_blank', 'noopener'); else overlayFrame.contentWindow.postMessage({ type: 'PROCESSING_ERROR', error: response?.error }, '*'); });
  if (message.type === 'EXPORT_OBSIDIAN') send({ type: 'EXPORT_OBSIDIAN', meetingId: message.meetingId }, (response) => { if (response?.uri) location.href = response.uri; else overlayFrame.contentWindow.postMessage({ type: 'PROCESSING_ERROR', error: response?.error }, '*'); });
  if (message.type === 'OPEN_WEB') send({ type: 'OPEN_WEB', meetingId: message.meetingId });
});

chrome.runtime.onMessage.addListener((message) => {
  if (['RECORDING_STARTED', 'PROCESSING_STARTED', 'PROCESSING_COMPLETE', 'PROCESSING_ERROR'].includes(message.type)) overlayFrame?.contentWindow?.postMessage(message, '*');
});

const captionObserver = new MutationObserver(() => {
  const candidates = document.querySelectorAll('[data-message-text], .iTTPOb, [jsname="tgaKEf"]');
  for (const node of candidates) {
    const value = node.textContent?.trim();
    if (!value || seenCaptions.has(value)) continue;
    seenCaptions.add(value);
    send({ type: 'CAPTION', caption: { text: value, speaker: node.parentElement?.querySelector('[data-self-name]')?.textContent || 'Google Meet caption', timestamp: Math.floor(performance.now() / 1000) } });
  }
});

captionObserver.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
setTimeout(injectOverlay, 1500);

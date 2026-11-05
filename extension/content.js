let overlayFrame = null;
const seenCaptions = new Set();
const participants = new Set();

function cleanName(value) {
  return String(value || '').replace(/\s+\(You\)$/i, '').replace(/\s+/g, ' ').trim();
}

function readPrimedContext() {
  const match = location.hash.match(/^#manuscript=(.+)$/);
  if (!match) return null;
  try {
    const value = JSON.parse(decodeURIComponent(match[1]));
    return value && typeof value === 'object' ? value : null;
  } catch { return null; }
}

const primedContext = readPrimedContext();
for (const name of primedContext?.participants || []) participants.add(cleanName(name));

function participantName(node) {
  const container = node.closest?.('[data-participant-id], [data-requested-participant-id], [role="listitem"], [aria-live]') || node.parentElement;
  const selectors = ['[data-self-name]', '[data-participant-name]', '.NWpY1d', '[jsname="EydYod"]', '[class*="speaker"]'];
  for (const selector of selectors) {
    const value = cleanName(container?.querySelector?.(selector)?.textContent);
    if (value && value.length <= 80) return value;
  }
  const aria = cleanName(container?.getAttribute?.('aria-label'));
  if (aria && aria.length <= 80 && !/captions?|microphone|camera|presenting/i.test(aria)) return aria;
  return '';
}

function collectParticipants() {
  const nodes = document.querySelectorAll('[data-participant-id], [data-requested-participant-id], [data-self-name]');
  for (const node of nodes) {
    const name = participantName(node) || cleanName(node.getAttribute?.('data-self-name'));
    if (name) participants.add(name);
  }
  if (participants.size) send({ type: 'PARTICIPANTS', participants: [...participants] });
}

function injectOverlay() {
  if (overlayFrame || !location.href.startsWith('https://meet.google.com/')) return;
  overlayFrame = document.createElement('iframe');
  overlayFrame.src = chrome.runtime.getURL('overlay/overlay.html');
  overlayFrame.title = 'Manuscript meeting controls';
  Object.assign(overlayFrame.style, { position: 'fixed', right: '24px', bottom: '88px', width: '400px', height: '300px', zIndex: '2147483647', border: '0', background: 'transparent' });
  document.documentElement.appendChild(overlayFrame);
  overlayFrame.addEventListener('load', () => { if (primedContext) overlayFrame.contentWindow.postMessage({ type: 'PRIMED_CONTEXT', context: primedContext }, '*'); });
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
  if (message.type === 'START_RECORDING') {
    collectParticipants();
    const meetingUrl = new URL(location.href); meetingUrl.hash = '';
    send({ type: 'START_RECORDING', meetingUrl: meetingUrl.toString(), meetingTitle: primedContext?.title || document.title, participants: [...participants], agenda: primedContext?.agenda || '' }, (response) => overlayFrame.contentWindow.postMessage({ type: response?.success ? 'RECORDING_STARTED' : 'PROCESSING_ERROR', error: response?.error }, '*'));
  }
  if (message.type === 'STOP_RECORDING') send({ type: 'STOP_RECORDING' });
  if (message.type === 'LIVE_NOTE') send({ type: 'LIVE_NOTE', text: message.text, timestamp: message.timestamp });
  if (message.type === 'FLAG_DECISION') send({ type: 'LIVE_NOTE', kind: 'decision', text: message.text || 'Decision flagged during meeting', timestamp: message.timestamp });
  if (message.type === 'DRAG_OVERLAY') {
    const right = Math.max(0, Math.min(innerWidth - 160, (parseFloat(overlayFrame.style.right) || 24) - Number(message.dx || 0)));
    const bottom = Math.max(0, Math.min(innerHeight - 80, (parseFloat(overlayFrame.style.bottom) || 88) - Number(message.dy || 0)));
    overlayFrame.style.right = `${right}px`; overlayFrame.style.bottom = `${bottom}px`;
  }
  if (message.type === 'EXPORT_NOTION') send({ type: 'EXPORT_NOTION', meetingId: message.meetingId }, (response) => { if (response?.url) window.open(response.url, '_blank', 'noopener'); else overlayFrame.contentWindow.postMessage({ type: 'PROCESSING_ERROR', error: response?.error }, '*'); });
  if (message.type === 'EXPORT_OBSIDIAN') send({ type: 'EXPORT_OBSIDIAN', meetingId: message.meetingId }, (response) => { if (response?.uri) location.href = response.uri; else overlayFrame.contentWindow.postMessage({ type: 'PROCESSING_ERROR', error: response?.error }, '*'); });
  if (message.type === 'OPEN_WEB') send({ type: 'OPEN_WEB', meetingId: message.meetingId });
  if (message.type === 'OPEN_ACTIONS') send({ type: 'OPEN_ACTIONS', meetingId: message.meetingId });
});

chrome.runtime.onMessage.addListener((message) => {
  if (['RECORDING_STARTED', 'PROCESSING_STARTED', 'PROCESSING_COMPLETE', 'PROCESSING_ERROR'].includes(message.type)) overlayFrame?.contentWindow?.postMessage(message, '*');
});

const captionObserver = new MutationObserver(() => {
  collectParticipants();
  const candidates = document.querySelectorAll('[data-message-text], .iTTPOb, [jsname="tgaKEf"], [aria-live="polite"] [dir="auto"]');
  for (const node of candidates) {
    const value = cleanName(node.getAttribute?.('data-message-text') || node.textContent);
    const speaker = participantName(node) || 'Google Meet caption';
    const key = `${speaker}\n${value}`;
    if (!value || value === speaker || seenCaptions.has(key)) continue;
    seenCaptions.add(key);
    if (speaker !== 'Google Meet caption') participants.add(speaker);
    send({ type: 'CAPTION', caption: { text: value, speaker, timestamp: Math.floor(performance.now() / 1000) } });
  }
});

captionObserver.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
setTimeout(injectOverlay, 1500);
setTimeout(collectParticipants, 2000);

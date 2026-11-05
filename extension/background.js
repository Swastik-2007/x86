const DEFAULT_BACKEND_URL = 'http://localhost:3001';
let activeMeetingTabId = null;
let recordingTabId = null;
let liveNotes = [];
let captions = [];

const backendUrl = async () => {
  const stored = await chrome.storage.local.get('backendUrl');
  return String(stored.backendUrl || DEFAULT_BACKEND_URL).replace(/\/$/, '');
};

async function ensureOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA', 'BLOBS'],
    justification: 'Mix and record user-authorized Google Meet tab audio and microphone audio.',
  });
}

function sendToMeeting(message) {
  if (activeMeetingTabId != null) chrome.tabs.sendMessage(activeMeetingTabId, message).catch(() => {});
}

async function startRecording(message, sender) {
  const tabId = sender.tab?.id || activeMeetingTabId;
  if (tabId == null) throw new Error('Open a Google Meet tab before recording');
  await ensureOffscreenDocument();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  recordingTabId = tabId;
  liveNotes = [];
  captions = [];
  const url = await backendUrl();
  await chrome.runtime.sendMessage({
    target: 'offscreen', type: 'OFFSCREEN_START', streamId, backendUrl: url,
    meetingUrl: message.meetingUrl, meetingTitle: message.meetingTitle, startedAt: new Date().toISOString(),
  });
  chrome.action.setBadgeText({ text: 'REC' });
  chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
  sendToMeeting({ type: 'RECORDING_STARTED' });
  return { success: true };
}

async function stopRecording() {
  if (recordingTabId == null) return { success: false, error: 'No recording is active' };
  sendToMeeting({ type: 'PROCESSING_STARTED' });
  chrome.action.setBadgeText({ text: '…' });
  await chrome.runtime.sendMessage({ target: 'offscreen', type: 'OFFSCREEN_STOP', liveNotes, captions });
  recordingTabId = null;
  return { success: true };
}

async function exportNotion(meetingId) {
  const response = await fetch(`${await backendUrl()}/api/export/notion/${encodeURIComponent(meetingId)}`, { method: 'POST' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Notion export failed');
  return result;
}

async function exportObsidian(meetingId) {
  const response = await fetch(`${await backendUrl()}/api/export/obsidian/${encodeURIComponent(meetingId)}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Obsidian export failed');
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'offscreen') return false;
  (async () => {
    switch (message.type) {
      case 'START_RECORDING': return startRecording(message, sender);
      case 'STOP_RECORDING': return stopRecording();
      case 'LIVE_NOTE': liveNotes.push({ text: message.text, timestamp: message.timestamp }); return { success: true };
      case 'CAPTION': captions.push(message.caption); return { success: true };
      case 'GET_STATUS': return { recording: recordingTabId != null, backendUrl: await backendUrl() };
      case 'CHECK_BACKEND': {
        const response = await fetch(`${await backendUrl()}/api/health`);
        if (!response.ok) throw new Error(`Backend returned ${response.status}`);
        return { success: true, health: await response.json() };
      }
      case 'EXPORT_NOTION': return exportNotion(message.meetingId);
      case 'EXPORT_OBSIDIAN': return exportObsidian(message.meetingId);
      case 'OPEN_WEB': {
        const parsed = new URL(await backendUrl());
        parsed.port = '5173';
        chrome.tabs.create({ url: message.meetingId ? `${parsed.origin}/?meeting=${encodeURIComponent(message.meetingId)}` : parsed.origin });
        return { success: true };
      }
      case 'OFFSCREEN_COMPLETE':
        chrome.action.setBadgeText({ text: '' });
        sendToMeeting({ type: 'PROCESSING_COMPLETE', result: message.result });
        return { success: true };
      case 'OFFSCREEN_ERROR':
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
        sendToMeeting({ type: 'PROCESSING_ERROR', error: message.error });
        return { success: true };
      default: return { success: false, error: 'Unknown message' };
    }
  })().then(sendResponse).catch((error) => sendResponse({ success: false, error: error.message }));
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (tab.url?.startsWith('https://meet.google.com/')) activeMeetingTabId = tabId;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === recordingTabId) stopRecording().catch(() => {});
  if (tabId === activeMeetingTabId) activeMeetingTabId = null;
});

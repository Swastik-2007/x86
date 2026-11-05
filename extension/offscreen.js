let recorder = null;
let chunks = [];
let tabStream = null;
let micStream = null;
let mixedStream = null;
let audioContext = null;
let metadata = null;

function stopTracks(stream) { stream?.getTracks().forEach((track) => track.stop()); }

async function start(message) {
  if (recorder?.state === 'recording') throw new Error('A recording is already active');
  tabStream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: message.streamId } },
    video: false,
  });
  try { micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { micStream = null; }
  audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  const tabSource = audioContext.createMediaStreamSource(tabStream);
  tabSource.connect(destination);
  tabSource.connect(audioContext.destination);
  if (micStream?.getAudioTracks().length) audioContext.createMediaStreamSource(micStream).connect(destination);
  mixedStream = destination.stream;
  chunks = [];
  metadata = message;
  const mimeType = ['audio/webm;codecs=opus', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type)) || '';
  recorder = new MediaRecorder(mixedStream, mimeType ? { mimeType } : undefined);
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  recorder.start(1000);
  return { success: true, microphone: Boolean(micStream) };
}

async function upload(message) {
  const blob = await new Promise((resolve) => {
    recorder.addEventListener('stop', () => resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })), { once: true });
    recorder.stop();
  });
  stopTracks(tabStream); stopTracks(micStream); stopTracks(mixedStream);
  await audioContext.close();
  const form = new FormData();
  form.append('audio', blob, `google-meet-${Date.now()}.webm`);
  form.append('title', metadata.meetingTitle || 'Google Meet');
  form.append('meetingUrl', metadata.meetingUrl || '');
  form.append('startedAt', metadata.startedAt);
  form.append('liveNotes', JSON.stringify(message.liveNotes || []));
  form.append('captions', JSON.stringify(message.captions || []));
  const response = await fetch(`${metadata.backendUrl}/api/meetings/upload-audio`, { method: 'POST', body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Upload failed (${response.status})`);
  return result;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;
  if (message.type === 'OFFSCREEN_START') {
    start(message).then(sendResponse).catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
  if (message.type === 'OFFSCREEN_STOP') {
    upload(message).then((result) => chrome.runtime.sendMessage({ type: 'OFFSCREEN_COMPLETE', result }))
      .catch((error) => chrome.runtime.sendMessage({ type: 'OFFSCREEN_ERROR', error: error.message }));
    sendResponse({ success: true });
    return true;
  }
  return false;
});

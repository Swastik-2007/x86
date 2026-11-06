function stopTracks(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function getBrowserCaptureSupport({ includeTab = false, environment = globalThis } = {}) {
  const mediaDevices = environment.navigator?.mediaDevices;
  if (environment.isSecureContext === false) {
    return {
      supported: false,
      code: 'INSECURE_CONTEXT',
      reason: 'Chrome blocks browser audio capture on plain HTTP pages opened from another machine. Use the Manuscript Chrome extension in Google Meet, serve the dashboard over HTTPS, or open it through a localhost SSH tunnel.',
    };
  }
  if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
    return {
      supported: false,
      code: 'MEDIA_DEVICES_UNAVAILABLE',
      reason: 'This browser context does not expose microphone capture. Use the Manuscript Chrome extension in Google Meet or open the dashboard from a secure HTTPS/localhost address.',
    };
  }
  if (includeTab && typeof mediaDevices.getDisplayMedia !== 'function') {
    return {
      supported: false,
      code: 'DISPLAY_CAPTURE_UNAVAILABLE',
      reason: 'This browser context does not support shared-tab capture. Use the Manuscript Chrome extension in Google Meet, or use a current Chrome build over HTTPS/localhost.',
    };
  }
  if (typeof environment.AudioContext !== 'function' || typeof environment.MediaRecorder !== 'function') {
    return {
      supported: false,
      code: 'RECORDING_API_UNAVAILABLE',
      reason: 'This browser does not provide the Web Audio and MediaRecorder APIs required for dashboard recording.',
    };
  }
  return { supported: true, code: 'SUPPORTED', reason: '' };
}

export async function startBrowserRecording({ includeTab = false } = {}) {
  const support = getBrowserCaptureSupport({ includeTab });
  if (!support.supported) {
    const error = new Error(support.reason);
    error.code = support.code;
    throw error;
  }
  const sources = [];
  let displayStream = null;
  let micStream = null;
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();

  try {
    if (includeTab) {
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (displayStream.getAudioTracks().length) sources.push(displayStream);
    }
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    sources.push(micStream);
    for (const stream of sources) context.createMediaStreamSource(stream).connect(destination);
    if (!destination.stream.getAudioTracks().length) throw new Error('No audio track was available');

    const mimeType = ['audio/webm;codecs=opus', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type)) || '';
    const recorder = new MediaRecorder(destination.stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    recorder.addEventListener('dataavailable', (event) => { if (event.data.size) chunks.push(event.data); });
    recorder.start(1000);

    return {
      stop: () => new Promise((resolve) => {
        recorder.addEventListener('stop', async () => {
          stopTracks(displayStream);
          stopTracks(micStream);
          stopTracks(destination.stream);
          await context.close();
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
        }, { once: true });
        recorder.stop();
      }),
      cancel: async () => {
        if (recorder.state !== 'inactive') recorder.stop();
        stopTracks(displayStream);
        stopTracks(micStream);
        await context.close();
      },
    };
  } catch (error) {
    stopTracks(displayStream);
    stopTracks(micStream);
    await context.close();
    throw error;
  }
}

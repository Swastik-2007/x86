function stopTracks(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

export async function startBrowserRecording({ includeTab = false } = {}) {
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

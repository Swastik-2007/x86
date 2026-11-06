'use strict';

const fs = require('node:fs');
const {
  DEFAULT_WHISPER_MODEL, normalizeUrl, whisperCandidates, findWhisper,
} = require('../../local-ai');

const HINGLISH_PROMPT = 'Hello everyone, my name is Gokul Prasath. This is a bilingual meeting in English and Hindi (Hinglish). Transcribe English words in English Latin script and Hindi clearly.';

function endpointCandidates(value) {
  const base = normalizeUrl(value, 'http://192.168.64.1:8000');
  if (/\/(?:v1\/audio\/transcriptions|inference|transcribe)$/i.test(base)) return [base];
  if (/\/v1$/i.test(base)) return [`${base}/audio/transcriptions`, `${base.replace(/\/v1$/i, '')}/inference`, `${base.replace(/\/v1$/i, '')}/transcribe`];
  return [`${base}/v1/audio/transcriptions`, `${base}/inference`, `${base}/transcribe`];
}

function parseTime(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseResponse(payload) {
  const source = Array.isArray(payload) ? payload : (payload?.segments || payload?.chunks || payload?.transcription || []);
  const segments = Array.isArray(source) ? source.map((segment, index) => {
    if (typeof segment === 'string') return { speaker: 'Speaker 1', text: segment, startTime: index, endTime: index };
    const timestamp = Array.isArray(segment.timestamp) ? segment.timestamp : [];
    const startTime = parseTime(segment.start ?? segment.start_time ?? timestamp[0], index);
    return {
      speaker: String(segment.speaker || segment.speaker_name || segment.name || 'Speaker 1').trim(),
      text: String(segment.text || segment.transcript || '').trim(),
      startTime,
      endTime: parseTime(segment.end ?? segment.end_time ?? timestamp[1], startTime),
    };
  }).filter((segment) => segment.text) : [];
  if (!segments.length) {
    const text = String(payload?.text || payload?.transcript || payload?.result || '').trim();
    if (text) segments.push({ speaker: 'Speaker 1', text, startTime: 0, endTime: parseTime(payload?.duration, 0) });
  }
  return segments;
}

async function postAudio(endpoint, wavPath, model, config, fetchImpl) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(wavPath)], { type: 'audio/wav' }), 'meeting.wav');
  form.append('model', model || DEFAULT_WHISPER_MODEL);
  form.append('prompt', HINGLISH_PROMPT);
  form.append('initial_prompt', HINGLISH_PROMPT);
  const language = String(config.transcriptionLanguage || 'hinglish').toLowerCase();
  if (language === 'en' || language === 'hi') form.append('language', language);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  const response = await fetchImpl(endpoint, { method: 'POST', body: form });
  const raw = await response.text();
  let payload;
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { text: raw }; }
  if (!response.ok) {
    const error = new Error(`Local Whisper returned HTTP ${response.status}: ${payload?.error?.message || payload?.error || raw || 'request failed'}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function transcribe({ wavPath, model, config, onProgress }, deps = {}) {
  if (!fs.existsSync(wavPath)) throw new Error(`Audio file not found: ${wavPath}`);
  if (fs.statSync(wavPath).size <= 44) throw new Error('The normalized audio recording is empty');
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const endpoints = whisperCandidates(config, deps).flatMap(endpointCandidates);
  const failures = [];
  onProgress?.(0);
  for (const endpoint of endpoints) {
    try {
      const segments = parseResponse(await postAudio(endpoint, wavPath, config.localWhisperModel || model || DEFAULT_WHISPER_MODEL, config, fetchImpl));
      if (!segments.length) throw new Error('Local Whisper returned an empty transcript');
      onProgress?.(1);
      return segments;
    } catch (error) {
      failures.push(`${endpoint}: ${error.message}`);
    }
  }
  throw new Error(`Local Whisper transcription failed. ${failures.join(' | ')}`);
}

async function test({ config }, deps = {}) {
  const result = await findWhisper(config, deps);
  if (!result.ok) throw new Error(result.error || 'Python Whisper is unavailable');
}

module.exports = {
  id: 'local-whisper',
  name: 'Local Python Whisper',
  badge: 'Mac local',
  icon: 'local',
  pricing: 'Runs locally on your MacBook',
  description: 'Sends normalized audio over the UTM bridge to an OpenAI-compatible or common Python Whisper endpoint.',
  credentials: [
    { configKey: 'localWhisperUrl', label: 'Python Whisper server URL', type: 'url', placeholder: 'http://192.168.64.1:8000', required: true },
  ],
  models: [{ id: DEFAULT_WHISPER_MODEL, name: 'MLX Whisper Large V3 Turbo', badge: 'Local default' }],
  defaultModel: DEFAULT_WHISPER_MODEL,
  allowCustomModel: true,
  capabilities: { diarization: true, local: true },
  transcribe,
  test,
  _internals: { endpointCandidates, parseResponse, postAudio, HINGLISH_PROMPT },
};

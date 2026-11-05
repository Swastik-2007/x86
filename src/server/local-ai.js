'use strict';

const LOCAL_SETTING_KEYS = new Set([
  'localWhisperUrl', 'localWhisperModel', 'lmStudioBaseUrl', 'lmStudioModel',
  'userName', 'defaultParticipants',
]);

function normalizeUrl(value, fallback) {
  const raw = String(value || fallback || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(raw)) throw new Error(`Invalid local service URL: ${raw || '(empty)'}`);
  return raw;
}

function withTimeout(ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function probe(url, { fetchImpl = globalThis.fetch, label = 'Local service' } = {}) {
  const timer = withTimeout();
  try {
    const response = await fetchImpl(url, { method: 'GET', signal: timer.signal });
    if (response.status >= 500) throw new Error(`${label} returned HTTP ${response.status}`);
    return { ok: true, status: response.status, url };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`${label} timed out at ${url}`);
    throw new Error(`${label} is not reachable at ${url}: ${error.message}`);
  } finally {
    timer.done();
  }
}

async function testLocalAi(config, deps = {}) {
  const whisperUrl = normalizeUrl(config.localWhisperUrl, 'http://192.168.64.1:8000');
  const lmBase = normalizeUrl(config.lmStudioBaseUrl, 'http://192.168.64.1:1234/v1');
  const lmModelsUrl = /\/v1$/i.test(lmBase) ? `${lmBase}/models` : `${lmBase}/v1/models`;
  const results = {};
  await Promise.all([
    probe(whisperUrl, { ...deps, label: 'Python Whisper' })
      .then((value) => { results.whisper = value; })
      .catch((error) => { results.whisper = { ok: false, error: error.message, url: whisperUrl }; }),
    probe(lmModelsUrl, { ...deps, label: 'LM Studio' })
      .then((value) => { results.lmStudio = value; })
      .catch((error) => { results.lmStudio = { ok: false, error: error.message, url: lmModelsUrl }; }),
  ]);
  return { ok: Boolean(results.whisper?.ok && results.lmStudio?.ok), ...results };
}

function splitSettings(updates = {}) {
  const local = {};
  const config = {};
  for (const [key, value] of Object.entries(updates)) (LOCAL_SETTING_KEYS.has(key) ? local : config)[key] = value;
  return { local, config };
}

module.exports = { LOCAL_SETTING_KEYS, normalizeUrl, probe, testLocalAi, splitSettings };

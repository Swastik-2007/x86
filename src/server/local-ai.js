'use strict';

const { execFileSync } = require('node:child_process');

const DEFAULT_WHISPER_URL = 'http://192.168.64.1:8000';
const DEFAULT_WHISPER_MODEL = 'mlx-community/whisper-large-v3-turbo';
const DEFAULT_LM_STUDIO_URL = 'http://192.168.64.1:1234/v1';
const DEFAULT_LM_STUDIO_MODEL = 'lfm3-1.7b';
const FALLBACK_HOSTS = ['192.168.64.1', '10.0.2.2', 'localhost'];
const LOCAL_SETTING_KEYS = new Set([
  'localWhisperUrl', 'localWhisperModel', 'lmStudioBaseUrl', 'lmStudioModel',
  'userName', 'defaultParticipants',
]);

function normalizeUrl(value, fallback) {
  const raw = String(value || fallback || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(raw)) throw new Error(`Invalid local service URL: ${raw || '(empty)'}`);
  return raw;
}

function detectDefaultGateway({ execFileSyncImpl = execFileSync } = {}) {
  try {
    const output = String(execFileSyncImpl('ip', ['route', 'show', 'default'], { encoding: 'utf8', timeout: 2000 }) || '');
    return output.match(/\bdefault\s+via\s+(\d{1,3}(?:\.\d{1,3}){3})\b/)?.[1] || '';
  } catch { return ''; }
}

function serviceCandidates(configured, { port, suffix = '', gateway = detectDefaultGateway() } = {}) {
  const values = configured ? [normalizeUrl(configured)] : [];
  for (const host of [gateway, ...FALLBACK_HOSTS].filter(Boolean)) values.push(`http://${host}:${port}${suffix}`);
  return [...new Set(values.map((value) => normalizeUrl(value)))];
}

function whisperCandidates(config = {}, deps = {}) {
  return serviceCandidates(config.localWhisperUrl, { port: 8000, gateway: deps.gateway ?? detectDefaultGateway(deps) });
}

function lmStudioCandidates(config = {}, deps = {}) {
  return serviceCandidates(config.lmStudioBaseUrl, { port: 1234, suffix: '/v1', gateway: deps.gateway ?? detectDefaultGateway(deps) });
}

function modelsUrl(value) {
  const base = normalizeUrl(value, DEFAULT_LM_STUDIO_URL);
  return /\/v1$/i.test(base) ? `${base}/models` : `${base}/v1/models`;
}

function withTimeout(ms = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function probe(url, { fetchImpl = globalThis.fetch, label = 'Local service', timeoutMs = 3000 } = {}) {
  const timer = withTimeout(timeoutMs);
  try {
    const response = await fetchImpl(url, { method: 'GET', signal: timer.signal });
    if (Number(response.status) >= 500) throw new Error(`${label} returned HTTP ${response.status}`);
    return { ok: true, status: Number(response.status) || 200, url };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`${label} timed out at ${url}`);
    throw new Error(`${label} is not reachable at ${url}: ${error.message}`);
  } finally { timer.done(); }
}

async function loadedLmStudioModels(baseUrl, { fetchImpl = globalThis.fetch, timeoutMs = 3000 } = {}) {
  const url = modelsUrl(baseUrl);
  const timer = withTimeout(timeoutMs);
  try {
    const response = await fetchImpl(url, { method: 'GET', signal: timer.signal });
    const raw = typeof response.text === 'function' ? await response.text() : '';
    let payload = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
    if (Number(response.status) >= 400) throw new Error(`HTTP ${response.status}: ${payload?.error?.message || raw || 'request failed'}`);
    return (Array.isArray(payload.data) ? payload.data : []).map((item) => String(item?.id || item).trim()).filter(Boolean);
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`LM Studio timed out at ${url}`);
    throw error;
  } finally { timer.done(); }
}

async function findWhisper(config, deps = {}) {
  const candidates = whisperCandidates(config, deps);
  const failures = [];
  for (const url of candidates) {
    try {
      return { ...(await probe(url, { ...deps, label: 'Python Whisper' })), model: DEFAULT_WHISPER_MODEL };
    } catch (error) { failures.push(error.message); }
  }
  return { ok: false, error: failures.join(' | '), url: candidates[0] || DEFAULT_WHISPER_URL, model: DEFAULT_WHISPER_MODEL };
}

async function findLmStudio(config, deps = {}) {
  const desiredModel = String(config.lmStudioModel || DEFAULT_LM_STUDIO_MODEL).trim();
  const candidates = lmStudioCandidates(config, deps);
  const failures = [];
  for (const url of candidates) {
    try {
      const loadedModels = await loadedLmStudioModels(url, deps);
      if (!loadedModels.length) throw new Error('LM Studio has no loaded models');
      const model = loadedModels.includes(desiredModel) ? desiredModel : loadedModels[0];
      return { ok: true, status: 200, url, modelsUrl: modelsUrl(url), model, loadedModels };
    } catch (error) { failures.push(`${url}: ${error.message}`); }
  }
  return { ok: false, error: failures.join(' | '), url: candidates[0] || DEFAULT_LM_STUDIO_URL, model: desiredModel };
}

async function testLocalAi(config = {}, deps = {}) {
  const [whisper, lmStudio] = await Promise.all([findWhisper(config, deps), findLmStudio(config, deps)]);
  const settings = {};
  if (whisper.ok) Object.assign(settings, { localWhisperUrl: whisper.url, localWhisperModel: whisper.model });
  if (lmStudio.ok) Object.assign(settings, { lmStudioBaseUrl: lmStudio.url, lmStudioModel: lmStudio.model });
  return { ok: Boolean(whisper.ok && lmStudio.ok), detectedGateway: deps.gateway ?? detectDefaultGateway(deps), whisper, lmStudio, settings };
}

function splitSettings(updates = {}) {
  const local = {};
  const config = {};
  for (const [key, value] of Object.entries(updates)) (LOCAL_SETTING_KEYS.has(key) ? local : config)[key] = value;
  return { local, config };
}

module.exports = {
  DEFAULT_WHISPER_URL, DEFAULT_WHISPER_MODEL, DEFAULT_LM_STUDIO_URL, DEFAULT_LM_STUDIO_MODEL,
  LOCAL_SETTING_KEYS, normalizeUrl, detectDefaultGateway, serviceCandidates, whisperCandidates,
  lmStudioCandidates, modelsUrl, probe, loadedLmStudioModels, findWhisper, findLmStudio, testLocalAi, splitSettings,
};

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { sttRegistry, llmRegistry } = require('./providers');

const dataDir = path.resolve(process.env.MANUSCRIPT_DATA_DIR || path.join(process.cwd(), '.data'));
const configPath = path.join(dataDir, 'config.json');
const defaults = {
  sttService: 'groq', sttModels: {}, llmProvider: 'gemini', llmModels: {}, llmFallback: {},
  groqApiKey: '', geminiApiKey: '', claudeApiKey: '', sarvamApiKey: '', assemblyAiApiKey: '',
  googleApiKey: '', googleCloudProjectId: '', googleCloudStorageBucket: '', googleCloudStorageKeyPath: '',
  notionToken: '', notionDatabaseId: '', obsidianVault: '',
  localWhisperUrl: 'http://192.168.64.1:8000', localWhisperModel: 'whisper-1',
  lmStudioBaseUrl: 'http://192.168.64.1:1234/v1', lmStudioModel: 'lfm2.5-1.2b-instruct',
  userName: '', defaultParticipants: [],
  autoSyncExports: false, language: 'unknown', enableDiarization: true, minSpeakers: 1, maxSpeakers: 8,
  systemPrompt: '', noteOutputMode: 'json', ffmpegPath: '',
};
const allowedKeys = new Set(Object.keys(defaults));

function readRaw() {
  fs.mkdirSync(dataDir, { recursive: true });
  try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') console.warn(`[Manuscript] Ignoring invalid config: ${error.message}`);
    return {};
  }
}

function resolveModels(registry, saved = {}) {
  const result = {};
  for (const provider of registry.list()) result[provider.id] = registry.resolveModel(provider, saved[provider.id]);
  return result;
}

function getConfig() {
  const raw = { ...defaults, ...readRaw() };
  if (!sttRegistry.has(raw.sttService)) raw.sttService = sttRegistry.defaultId();
  if (!llmRegistry.has(raw.llmProvider)) raw.llmProvider = llmRegistry.defaultId();
  raw.sttModels = resolveModels(sttRegistry, raw.sttModels);
  raw.llmModels = resolveModels(llmRegistry, raw.llmModels);
  if (!llmRegistry.has(raw.llmFallback?.provider)) raw.llmFallback = {};
  return raw;
}

function updateConfig(updates) {
  const current = readRaw();
  for (const [key, value] of Object.entries(updates || {})) if (allowedKeys.has(key)) current[key] = value;
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
  return getConfig();
}

module.exports = { dataDir, getConfig, updateConfig, defaults };

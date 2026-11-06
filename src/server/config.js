'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { sttRegistry, llmRegistry } = require('./providers');
const { DEFAULT_WHISPER_URL, DEFAULT_WHISPER_MODEL, DEFAULT_LM_STUDIO_URL, DEFAULT_LM_STUDIO_MODEL } = require('./local-ai');

const dataDir = path.resolve(process.env.MANUSCRIPT_DATA_DIR || path.join(process.cwd(), '.data'));
const configPath = path.join(dataDir, 'config.json');
const defaults = {
  sttService: 'local-whisper', sttModels: { 'local-whisper': DEFAULT_WHISPER_MODEL },
  llmProvider: 'lm-studio', llmModels: { 'lm-studio': DEFAULT_LM_STUDIO_MODEL },
  notionToken: '', notionDatabaseId: '', obsidianVault: '',
  localWhisperUrl: DEFAULT_WHISPER_URL, localWhisperModel: DEFAULT_WHISPER_MODEL,
  lmStudioBaseUrl: DEFAULT_LM_STUDIO_URL, lmStudioModel: DEFAULT_LM_STUDIO_MODEL,
  userName: '', defaultParticipants: [],
  autoSyncExports: false, transcriptionLanguage: 'hinglish', enableDiarization: true, minSpeakers: 1, maxSpeakers: 8,
  noteOutputMode: 'json', ffmpegPath: '',
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
  const raw = { ...defaults };
  for (const [key, value] of Object.entries(readRaw())) if (allowedKeys.has(key)) raw[key] = value;
  raw.sttService = 'local-whisper';
  raw.llmProvider = 'lm-studio';
  raw.sttModels = resolveModels(sttRegistry, raw.sttModels);
  raw.llmModels = resolveModels(llmRegistry, raw.llmModels);
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

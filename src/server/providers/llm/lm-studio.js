'use strict';

const { normalizeUrl } = require('../../local-ai');
const { parseJsonObject } = require('../../notes/json-extract');

function chatUrl(value) {
  const base = normalizeUrl(value, 'http://192.168.64.1:1234/v1');
  if (/\/chat\/completions$/i.test(base)) return base;
  return /\/v1$/i.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

async function completion(url, body, fetchImpl) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let payload;
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
  if (!response.ok) throw new Error(`LM Studio returned HTTP ${response.status}: ${payload?.error?.message || raw || 'request failed'}`);
  const content = payload?.choices?.[0]?.message?.content;
  if (!String(content || '').trim()) throw new Error('LM Studio returned an empty completion');
  return String(content).trim();
}

async function generate({ systemPrompt, userPrompt, model, config, json, onText }, deps = {}) {
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const url = chatUrl(config.lmStudioBaseUrl);
  const selectedModel = String(config.lmStudioModel || model || 'local-model').trim();
  const body = {
    model: selectedModel,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    temperature: 0.2,
    stream: false,
  };
  if (json) body.response_format = { type: 'json_object' };
  let text = await completion(url, body, fetchImpl);
  if (json) {
    try { parseJsonObject(text); }
    catch {
      text = await completion(url, {
        ...body,
        temperature: 0,
        messages: [
          { role: 'system', content: 'Repair the supplied response. Return one valid JSON object only, with no markdown or commentary.' },
          { role: 'user', content: text },
        ],
      }, fetchImpl);
      parseJsonObject(text);
    }
  }
  onText?.(text);
  return text;
}

async function test({ config, model }, deps = {}) {
  await completion(chatUrl(config.lmStudioBaseUrl), {
    model: String(config.lmStudioModel || model || 'local-model').trim(),
    messages: [{ role: 'user', content: 'Reply with OK only.' }],
    max_tokens: 8,
    temperature: 0,
  }, deps.fetchImpl || globalThis.fetch);
}

module.exports = {
  id: 'lm-studio',
  name: 'LM Studio (Local LFM)',
  badge: 'Mac local',
  icon: 'local',
  pricing: 'Runs locally on your MacBook',
  description: 'Uses LM Studio’s OpenAI-compatible chat completions endpoint across the UTM bridge network.',
  credentials: [
    { configKey: 'lmStudioBaseUrl', label: 'LM Studio base URL', type: 'url', placeholder: 'http://192.168.64.1:1234/v1', required: true },
  ],
  models: [{ id: 'lfm2.5-1.2b-instruct', name: 'LFM 2.5 1.2B Instruct', badge: 'Default' }],
  defaultModel: 'lfm2.5-1.2b-instruct',
  allowCustomModel: true,
  capabilities: { local: true, json: true },
  generate,
  test,
  _internals: { chatUrl },
};

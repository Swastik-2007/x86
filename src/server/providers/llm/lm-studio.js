'use strict';

const { DEFAULT_LM_STUDIO_MODEL, normalizeUrl, findLmStudio } = require('../../local-ai');
const { parseJsonObject } = require('../../notes/json-extract');

const COMPLETION_TIMEOUT_MS = 180000;
const NATIVE_MAX_OUTPUT_TOKENS = 4096;
const OPENAI_MAX_TOKENS = 8192;

function chatUrl(value) {
  const base = normalizeUrl(value, 'http://192.168.64.1:1234/v1');
  if (/\/chat\/completions$/i.test(base)) return base;
  return /\/v1$/i.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

function nativeChatUrl(value) {
  const base = new URL(normalizeUrl(value, 'http://192.168.64.1:1234/v1'));
  return `${base.origin}/api/v1/chat`;
}

function stripThinking(value) {
  let text = String(value || '');
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (/<\/think>/i.test(text)) text = text.split(/<\/think>/i).pop().trim();
  return text;
}

function messageText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((part) => typeof part === 'string' ? part : part?.text || part?.content || '').join('\n');
}

async function postJson(url, body, fetchImpl, timeoutMs, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload;
    try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
    if (!response.ok) {
      const error = new Error(`${label} returned HTTP ${response.status}: ${payload?.error?.message || payload?.error || raw || 'request failed'}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds`);
    throw error;
  } finally { clearTimeout(timer); }
}

async function completion(url, body, fetchImpl, timeoutMs = COMPLETION_TIMEOUT_MS) {
  const payload = await postJson(url, body, fetchImpl, timeoutMs, 'LM Studio OpenAI-compatible chat');
  const choice = payload?.choices?.[0] || {};
  const content = stripThinking(messageText(choice?.message?.content));
  if (content) return content;
  const reasoningTokens = Number(payload?.usage?.completion_tokens_details?.reasoning_tokens) || 0;
  const detail = [choice.finish_reason && `finish_reason: ${choice.finish_reason}`, reasoningTokens && `reasoning_tokens: ${reasoningTokens}`].filter(Boolean).join(', ');
  const error = new Error(`LM Studio used the completion budget without returning a final message${detail ? ` (${detail})` : ''}`);
  error.code = 'EMPTY_LM_CONTENT';
  error.finishReason = choice.finish_reason || '';
  error.reasoningTokens = reasoningTokens;
  throw error;
}

async function nativeCompletion(url, body, fetchImpl, timeoutMs = COMPLETION_TIMEOUT_MS) {
  const payload = await postJson(url, body, fetchImpl, timeoutMs, 'LM Studio native chat');
  const content = stripThinking((Array.isArray(payload?.output) ? payload.output : [])
    .filter((item) => item?.type === 'message')
    .map((item) => messageText(item.content))
    .filter(Boolean)
    .join('\n'));
  if (content) return content;
  const reasoningTokens = Number(payload?.stats?.reasoning_output_tokens) || 0;
  const error = new Error(`LM Studio native chat returned no final message${reasoningTokens ? ` (reasoning_tokens: ${reasoningTokens})` : ''}`);
  error.code = 'EMPTY_LM_CONTENT';
  error.reasoningTokens = reasoningTokens;
  throw error;
}

function requestBody(model, messages, { json = true, temperature = 0.1, maxTokens = OPENAI_MAX_TOKENS } = {}) {
  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };
  if (json) body.response_format = { type: 'json_object' };
  return body;
}

function nativeRequestBody(model, systemPrompt, userPrompt, { temperature = 0.1 } = {}) {
  return {
    model,
    system_prompt: systemPrompt,
    input: userPrompt,
    temperature,
    max_output_tokens: NATIVE_MAX_OUTPUT_TOKENS,
    reasoning: 'off',
    store: false,
    stream: false,
  };
}

async function completeWithFallback({ target, systemPrompt, userPrompt, json, temperature, fetchImpl, timeoutMs }) {
  try {
    return await nativeCompletion(
      nativeChatUrl(target.url),
      nativeRequestBody(target.model, systemPrompt, userPrompt, { temperature }),
      fetchImpl,
      timeoutMs,
    );
  } catch (nativeError) {
    try {
      return await completion(
        chatUrl(target.url),
        requestBody(target.model, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ], { json, temperature, maxTokens: OPENAI_MAX_TOKENS }),
        fetchImpl,
        timeoutMs,
      );
    } catch (openAiError) {
      openAiError.message = `${openAiError.message}. Native no-reasoning request also failed: ${nativeError.message}`;
      throw openAiError;
    }
  }
}

async function generate({ systemPrompt, userPrompt, config, json, onText }, deps = {}) {
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const target = await findLmStudio(config, { ...deps, fetchImpl });
  if (!target.ok) throw new Error(`LM Studio is unavailable. ${target.error}`);
  const noThinkPrompt = `/no_think\nKeep internal reasoning under 3 sentences. Output the requested ${json ? 'JSON' : 'answer'} immediately.\n${systemPrompt}`;
  let text = await completeWithFallback({
    target, systemPrompt: noThinkPrompt, userPrompt, json, temperature: 0.1, fetchImpl,
    timeoutMs: deps.timeoutMs || COMPLETION_TIMEOUT_MS,
  });
  if (json) {
    try { parseJsonObject(text); }
    catch {
      text = await completeWithFallback({
        target,
        systemPrompt: '/no_think\nRepair the supplied response. Return one valid JSON object only, with no markdown, think tags, or commentary.',
        userPrompt: text,
        json: true,
        temperature: 0,
        fetchImpl,
        timeoutMs: deps.timeoutMs || COMPLETION_TIMEOUT_MS,
      });
      parseJsonObject(text);
    }
  }
  onText?.(text);
  return text;
}

async function test({ config }, deps = {}) {
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const target = await findLmStudio(config, { ...deps, fetchImpl });
  if (!target.ok) throw new Error(target.error || 'LM Studio is unavailable');
  await completeWithFallback({
    target,
    systemPrompt: 'Reply with OK only.',
    userPrompt: 'Connection test.',
    json: false,
    temperature: 0,
    fetchImpl,
    timeoutMs: deps.timeoutMs || COMPLETION_TIMEOUT_MS,
  });
}

module.exports = {
  id: 'lm-studio',
  name: 'LM Studio (Local LFM)',
  badge: 'Mac local',
  icon: 'local',
  pricing: 'Runs locally on your MacBook',
  description: "Uses LM Studio's OpenAI-compatible chat completions endpoint across the UTM bridge network.",
  credentials: [
    { configKey: 'lmStudioBaseUrl', label: 'LM Studio base URL', type: 'url', placeholder: 'http://192.168.64.1:1234/v1', required: true },
  ],
  models: [{ id: DEFAULT_LM_STUDIO_MODEL, name: 'LFM3 1.7B', badge: 'Local default' }],
  defaultModel: DEFAULT_LM_STUDIO_MODEL,
  allowCustomModel: true,
  capabilities: { local: true, json: true },
  generate,
  test,
  _internals: {
    chatUrl, nativeChatUrl, stripThinking, messageText, completion, nativeCompletion,
    requestBody, nativeRequestBody, completeWithFallback, COMPLETION_TIMEOUT_MS,
    NATIVE_MAX_OUTPUT_TOKENS, OPENAI_MAX_TOKENS,
  },
};

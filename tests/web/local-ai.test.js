import { describe, expect, it, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import localAiModule from '../../src/server/local-ai';
import localWhisperModule from '../../src/server/providers/stt/local-whisper';
import pipelineModule from '../../src/server/pipeline';
import jsonExtractModule from '../../src/server/notes/json-extract';
import lmStudioModule from '../../src/server/providers/llm/lm-studio';

const {
  DEFAULT_WHISPER_MODEL, DEFAULT_LM_STUDIO_MODEL, normalizeUrl, detectDefaultGateway, findLmStudio, splitSettings, testLocalAi,
} = localAiModule;
const { endpointCandidates, parseResponse } = localWhisperModule._internals;
const { mergeCaptionNames } = pipelineModule;
const { parseJsonObject } = jsonExtractModule;

describe('local AI configuration', () => {
  it('stores local network endpoints separately from secret-backed config', () => {
    const result = splitSettings({ localWhisperUrl: 'http://mac:8000', lmStudioModel: 'lfm', userName: 'Gokul', defaultParticipants: ['Priya'], notionToken: 'secret' });
    expect(result.local).toEqual({ localWhisperUrl: 'http://mac:8000', lmStudioModel: 'lfm', userName: 'Gokul', defaultParticipants: ['Priya'] });
    expect(result.config).toEqual({ notionToken: 'secret' });
  });

  it('normalizes URLs and tests both local services', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url) => ({
      status: 200,
      text: async () => url.endsWith('/models') ? JSON.stringify({ data: [{ id: 'lfm3-loaded-id' }] }) : '',
    }));
    const result = await testLocalAi({ localWhisperUrl: 'http://mac:8000/', lmStudioBaseUrl: 'http://mac:1234/v1/' }, { fetchImpl });
    expect(normalizeUrl('http://mac:8000/')).toBe('http://mac:8000');
    expect(result.ok).toBe(true);
    expect(result.whisper.model).toBe(DEFAULT_WHISPER_MODEL);
    expect(result.lmStudio.model).toBe('lfm3-loaded-id');
    expect(fetchImpl).toHaveBeenCalledWith('http://mac:1234/v1/models', expect.objectContaining({ method: 'GET' }));
  });

  it('detects the Ubuntu default gateway and retains safe Mac host fallbacks', () => {
    expect(detectDefaultGateway({ execFileSyncImpl: () => 'default via 192.168.64.1 dev enp0s1 proto dhcp' })).toBe('192.168.64.1');
    expect(DEFAULT_LM_STUDIO_MODEL).toBe('lfm3-1.7b');
  });

  it('skips LM Studio endpoints that have no loaded model', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url) => ({
      status: 200,
      text: async () => JSON.stringify({ data: url.includes('first-host') ? [] : [{ id: 'actual-loaded-model' }] }),
    }));
    const result = await findLmStudio({ lmStudioBaseUrl: 'http://first-host:1234/v1' }, { fetchImpl, gateway: 'second-host' });
    expect(result).toMatchObject({ ok: true, url: 'http://second-host:1234/v1', model: 'actual-loaded-model' });
  });

  it('supports common Whisper endpoint layouts and response shapes', () => {
    expect(endpointCandidates('http://mac:8000')).toEqual([
      'http://mac:8000/v1/audio/transcriptions', 'http://mac:8000/inference', 'http://mac:8000/transcribe',
    ]);
    expect(parseResponse({ segments: [{ speaker: 'Priya', text: 'Ship it', start: 2, end: 3 }] })[0])
      .toEqual({ speaker: 'Priya', text: 'Ship it', startTime: 2, endTime: 3 });
  });

  it('sends the MLX model and bilingual prompt without authorization', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => JSON.stringify({ text: 'Hello everyone' }),
    });
    await localWhisperModule._internals.postAudio(
      'http://mac:8000/v1/audio/transcriptions', fileURLToPath(import.meta.url), DEFAULT_WHISPER_MODEL,
      { transcriptionLanguage: 'hinglish' }, fetchImpl,
    );
    const options = fetchImpl.mock.calls[0][1];
    expect(options.headers).toBeUndefined();
    expect(options.body.get('model')).toBe(DEFAULT_WHISPER_MODEL);
    expect(options.body.get('prompt')).toContain('English and Hindi');
    expect(options.body.get('language')).toBeNull();
  });

  it('uses named Meet captions to label generic audio segments', () => {
    const result = mergeCaptionNames(
      [{ speaker: 'Speaker 1', text: 'Ship it', startTime: 10, endTime: 12 }],
      [{ speaker: 'Priya', text: 'Ship it', startTime: 10, endTime: 12 }],
    );
    expect(result[0].speaker).toBe('Priya');
  });

  it('keeps summary, bilingual topics, decisions, and actions in structured meeting data', () => {
    const structured = pipelineModule.structuredNotes({
      summary: 'English summary', topics: [{ heading: 'Greeting', content: 'English meaning (नमस्ते nuance)' }],
      decisions: [{ decision: 'Proceed', quote: 'ठीक है' }], action_items: [{ task: 'Send notes', owner: 'Gokul' }],
    });
    expect(structured).toMatchObject({
      summary: 'English summary', topics: [{ heading: 'Greeting' }],
      decisions: [{ decision: 'Proceed' }], action_items: [{ task: 'Send notes' }],
    });
    expect(pipelineModule.P8_PROMPT).toContain('phonetic Devanagari');
  });

  it('extracts JSON from fences and conversational local-model output', () => {
    const parsed = parseJsonObject('Here is the result:\n```json\n{"summary":"Done",}\n```\nHope this helps.');
    expect(parsed).toEqual({ summary: 'Done' });
  });

  it('uses native LM Studio chat with reasoning disabled and repairs invalid JSON', async () => {
    const responses = [
      { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 'lfm3-1.7b' }] }) },
      { ok: true, status: 200, text: async () => JSON.stringify({ output: [{ type: 'message', content: 'not-json' }] }) },
      { ok: true, status: 200, text: async () => JSON.stringify({ output: [{ type: 'message', content: '{"summary":"Repaired"}' }] }) },
    ];
    const fetchImpl = vi.fn().mockImplementation(async () => responses.shift());
    const output = await lmStudioModule.generate({
      systemPrompt: 'Return JSON', userPrompt: 'Meeting', model: 'lfm', json: true,
      config: { lmStudioBaseUrl: 'http://mac:1234/v1', lmStudioModel: 'lfm' },
    }, { fetchImpl });
    expect(parseJsonObject(output).summary).toBe('Repaired');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const completionBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(completionBody).toMatchObject({
      model: 'lfm3-1.7b', temperature: 0.1, max_output_tokens: 4096, reasoning: 'off', store: false,
    });
    expect(fetchImpl.mock.calls[1][0]).toBe('http://mac:1234/api/v1/chat');
  });

  it('falls back to the OpenAI-compatible endpoint with a larger final-answer budget', async () => {
    const responses = [
      { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 'lfm3-1.7b' }] }) },
      { ok: false, status: 404, text: async () => JSON.stringify({ error: 'native endpoint unavailable' }) },
      { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: '{"summary":"Compatible"}' }, finish_reason: 'stop' }] }) },
    ];
    const fetchImpl = vi.fn().mockImplementation(async () => responses.shift());
    const output = await lmStudioModule.generate({
      systemPrompt: 'Return JSON', userPrompt: 'Meeting', json: true,
      config: { lmStudioBaseUrl: 'http://mac:1234/v1', lmStudioModel: 'lfm3-1.7b' },
    }, { fetchImpl });
    expect(parseJsonObject(output).summary).toBe('Compatible');
    expect(fetchImpl.mock.calls[2][0]).toBe('http://mac:1234/v1/chat/completions');
    const body = JSON.parse(fetchImpl.mock.calls[2][1].body);
    expect(body.max_tokens).toBe(8192);
    expect(body).not.toHaveProperty('reasoning_effort');
    expect(body).not.toHaveProperty('chat_template_kwargs');
  });

  it('classifies a reasoning-only length response as recoverable empty content', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [{ message: { content: '', reasoning_content: 'private chain of thought' }, finish_reason: 'length' }],
        usage: { completion_tokens_details: { reasoning_tokens: 2048 } },
      }),
    });
    await expect(lmStudioModule._internals.completion(
      'http://mac:1234/v1/chat/completions', {}, fetchImpl, 1000,
    )).rejects.toMatchObject({ code: 'EMPTY_LM_CONTENT', finishReason: 'length', reasoningTokens: 2048 });
  });

  it('builds a usable transcript overview when LFM returns no final answer', () => {
    const notes = pipelineModule.fallbackMeetingNotes(
      [{ speaker: 'Gokul', text: 'Mic check and project introduction.' }],
      'Project sync',
      Object.assign(new Error('No final answer'), { code: 'EMPTY_LM_CONTENT' }),
      'lfm3-1.7b',
    );
    expect(notes).toMatchObject({
      title: 'Project sync',
      attendees: [{ label: 'Gokul', name: 'Gokul' }],
      topics: [{ heading: 'Transcript overview' }],
      decisions: [],
      action_items: [],
      _llmProvider: 'local-transcript-fallback',
    });
    expect(notes.summary).toContain('Mic check and project introduction.');
  });

  it('ignores think tags and parses only message content JSON', () => {
    const { stripThinking } = lmStudioModule._internals;
    expect(stripThinking('<think>private reasoning</think>\n{"summary":"Ready"}')).toBe('{"summary":"Ready"}');
  });
});

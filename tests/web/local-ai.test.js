import { describe, expect, it, vi } from 'vitest';
import localAiModule from '../../src/server/local-ai';
import localWhisperModule from '../../src/server/providers/stt/local-whisper';
import pipelineModule from '../../src/server/pipeline';
import jsonExtractModule from '../../src/server/notes/json-extract';
import lmStudioModule from '../../src/server/providers/llm/lm-studio';

const { normalizeUrl, splitSettings, testLocalAi } = localAiModule;
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
    const fetchImpl = vi.fn().mockResolvedValue({ status: 200 });
    const result = await testLocalAi({ localWhisperUrl: 'http://mac:8000/', lmStudioBaseUrl: 'http://mac:1234/v1/' }, { fetchImpl });
    expect(normalizeUrl('http://mac:8000/')).toBe('http://mac:8000');
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith('http://mac:1234/v1/models', expect.objectContaining({ method: 'GET' }));
  });

  it('supports common Whisper endpoint layouts and response shapes', () => {
    expect(endpointCandidates('http://mac:8000')).toEqual([
      'http://mac:8000/v1/audio/transcriptions', 'http://mac:8000/inference', 'http://mac:8000/transcribe',
    ]);
    expect(parseResponse({ segments: [{ speaker: 'Priya', text: 'Ship it', start: 2, end: 3 }] })[0])
      .toEqual({ speaker: 'Priya', text: 'Ship it', startTime: 2, endTime: 3 });
  });

  it('uses named Meet captions to label generic audio segments', () => {
    const result = mergeCaptionNames(
      [{ speaker: 'Speaker 1', text: 'Ship it', startTime: 10, endTime: 12 }],
      [{ speaker: 'Priya', text: 'Ship it', startTime: 10, endTime: 12 }],
    );
    expect(result[0].speaker).toBe('Priya');
  });

  it('extracts JSON from fences and conversational local-model output', () => {
    const parsed = parseJsonObject('Here is the result:\n```json\n{"summary":"Done",}\n```\nHope this helps.');
    expect(parsed).toEqual({ summary: 'Done' });
  });

  it('asks LM Studio for a repair completion when the first response is invalid', async () => {
    const responses = [
      { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'not-json' } }] }) },
      { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: '{"summary":"Repaired"}' } }] }) },
    ];
    const fetchImpl = vi.fn().mockImplementation(async () => responses.shift());
    const output = await lmStudioModule.generate({
      systemPrompt: 'Return JSON', userPrompt: 'Meeting', model: 'lfm', json: true,
      config: { lmStudioBaseUrl: 'http://mac:1234/v1', lmStudioModel: 'lfm' },
    }, { fetchImpl });
    expect(parseJsonObject(output).summary).toBe('Repaired');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

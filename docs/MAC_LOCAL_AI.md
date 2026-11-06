# MacBook Local AI services

Manuscript uses only two Mac-hosted services:

- MLX Whisper at port `8000` with `mlx-community/whisper-large-v3-turbo`.
- LM Studio at port `1234` with `lfm3-1.7b` or the first model returned by `/v1/models`.

Both services must listen on the Mac interface reachable from Ubuntu UTM, not only `127.0.0.1`. In Web Settings, select **Auto-Detect Mac Host IP & Test Local AI** after either service changes.

## Whisper bilingual prompt support

The Node client sends both `prompt` and `initial_prompt` multipart fields with every recording. The Mac `whisper_server.py` should pass this value to MLX Whisper or faster-whisper and should not force a language for the `hinglish` mode.

Use this prompt in the server when a request does not provide one:

```text
Hello everyone, my name is Gokul Prasath. This is a bilingual meeting in English and Hindi (Hinglish). Transcribe English words in English Latin script and Hindi clearly.
```

For MLX Whisper, pass `initial_prompt`, `condition_on_previous_text=False`, and `word_timestamps=False`. For faster-whisper, pass the same `initial_prompt`, `condition_on_previous_text=False`, and `vad_filter=True`. Reject an empty upload with HTTP 400 and return `text` plus timestamped `segments`.

Restart the Mac service after editing it:

```bash
python whisper_server.py
```

## LM Studio response controls

Manuscript queries `/v1/models` before generation. It first calls LM Studio's native `/api/v1/chat` endpoint with `reasoning: "off"`, `max_output_tokens: 4096`, temperature `0.1`, and a 180-second timeout. This is the reliable way to disable LFM3 thinking; unsupported fields sent to the OpenAI-compatible endpoint may be ignored.

If the native endpoint is unavailable, Manuscript falls back to `/v1/chat/completions` with an 8,192-token budget. It reads only the final message content, never stores or displays `reasoning_content`, and reports when reasoning exhausted the output budget. If both routes return no usable final answer, the meeting is still completed with a transcript-derived overview and can be retried with **Regenerate AI Summary** after LM Studio is updated or reloaded.

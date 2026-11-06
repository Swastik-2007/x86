# Maintaining Local AI engines

Manuscript is intentionally Local-AI-only. `src/server/providers/index.js` registers exactly the MacBook MLX Whisper and LM Studio engines. Do not add a cloud provider or credential requirement to capture, upload, transcription, or note generation.

## STT provider

The active `src/server/providers/stt/local-whisper.js` exports metadata plus:

```js
async function transcribe({ wavPath, model, config, onProgress }) {
  // Return [{ speaker, text, startTime, endTime }]
}

async function test({ config, model }) {}
```

Uploaded audio is mono 16 kHz WAV. The client sends it as multipart `file` with the hardwired MLX model and bilingual prompt. Keep gateway/fallback probing in `src/server/local-ai.js`; do not add browser-only APIs to provider code.

## LLM provider

The active `src/server/providers/llm/lm-studio.js` exports metadata plus:

```js
async function generate({ systemPrompt, userPrompt, model, config, json, onText }) {
  // Call onText(delta) while streaming and return the complete text.
}

async function test({ config, model }) {}
```

The P8 structured schema and bilingual rules are owned by `src/server/pipeline.js`; the engine must not weaken or rewrite them.

OpenAI-compatible local providers should normalize base URLs rather than require users to type `/chat/completions` exactly. Route all model text through `src/server/notes/json-extract.js` so fenced or conversational JSON is handled consistently.

Add only non-secret local endpoint/model settings to `LOCAL_SETTING_KEYS` in `src/server/local-ai.js` so they persist in SQLite. Expose the setting in `renderer/app.jsx`, update README and architecture docs, and add tests. Run `pnpm run lint`, `pnpm run test`, `pnpm run build:renderer`, and `node scripts/build-extension.js`.

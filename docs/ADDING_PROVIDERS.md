# Adding providers

Provider libraries are registered in `src/server/providers/index.js` and consumed by the Node API. They must remain runtime-neutral.

## STT provider

Create `src/server/providers/stt/<id>.js` exporting metadata plus:

```js
async function transcribe({ wavPath, model, config, onProgress }) {
  // Return [{ speaker, text, startTime, endTime }]
}

async function test({ config, model }) {}
```

Register it in the `sttRegistry` list. Uploaded audio is already mono 16 kHz WAV.

The built-in `local-whisper` provider is the exception that receives the original upload path so it can send multipart audio to the configured Mac service. Keep local/network probing in `src/server/local-ai.js`; do not add browser-only APIs to provider code.

## LLM provider

Create `src/server/providers/llm/<id>.js` exporting metadata plus:

```js
async function generate({ systemPrompt, userPrompt, model, config, json, onText }) {
  // Call onText(delta) while streaming and return the complete text.
}

async function test({ config, model }) {}
```

Register it in the `llmRegistry` list. The P8 structured schema is owned by `src/server/pipeline.js`; providers should not weaken or rewrite it.

OpenAI-compatible local providers should normalize base URLs rather than require users to type `/chat/completions` exactly. Route all model text through `src/server/notes/json-extract.js` so fenced or conversational JSON is handled consistently.

Add secret credential keys to `src/server/config.js`. Add non-secret local endpoint/model settings to `LOCAL_SETTING_KEYS` in `src/server/local-ai.js` so they persist in SQLite. Expose the setting in `renderer/app.jsx`, update README and architecture docs, and add tests. Run `pnpm run lint`, `pnpm run test`, `pnpm run build:renderer`, and `node scripts/build-extension.js`.

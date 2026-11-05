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

## LLM provider

Create `src/server/providers/llm/<id>.js` exporting metadata plus:

```js
async function generate({ systemPrompt, userPrompt, model, config, json, onText }) {
  // Call onText(delta) while streaming and return the complete text.
}

async function test({ config, model }) {}
```

Register it in the `llmRegistry` list. The P8 structured schema is owned by `src/server/pipeline.js`; providers should not weaken or rewrite it.

Add any credential key to `src/server/config.js`, expose it in `renderer/app.jsx` Settings, update README and architecture docs, and add tests. Run `pnpm run lint`, `pnpm run test`, and `pnpm run build`.

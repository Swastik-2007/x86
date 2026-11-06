/** Local-only provider registration. */
const { createRegistry } = require('./registry');

const sttRegistry = createRegistry('stt', ['transcribe', 'test']);
const llmRegistry = createRegistry('llm', ['generate', 'test']);

sttRegistry.register(require('./stt/local-whisper'));

llmRegistry.register(require('./llm/lm-studio'));

const registries = { stt: sttRegistry, llm: llmRegistry };

/** Serializable descriptors for the renderer. */
function describeProviders() {
  return { stt: sttRegistry.describeAll(), llm: llmRegistry.describeAll() };
}

/** Config keys contributed by providers: [{configKey, type, providerId, kind}]. */
function providerConfigKeys() {
  const seen = new Set();
  const out = [];
  for (const [kind, registry] of Object.entries(registries)) {
    for (const field of registry.configKeys()) {
      if (seen.has(field.configKey)) continue;
      seen.add(field.configKey);
      out.push({ ...field, kind });
    }
  }
  return out;
}

module.exports = { sttRegistry, llmRegistry, registries, describeProviders, providerConfigKeys };

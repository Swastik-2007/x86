'use strict';

const { parse: parsePartialJson } = require('partial-json');

function balancedObjects(text) {
  const source = String(text || '');
  const candidates = [];
  for (let start = source.indexOf('{'); start >= 0; start = source.indexOf('{', start + 1)) {
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let index = start; index < source.length; index++) {
      const char = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === quote) quote = '';
        continue;
      }
      if (char === '"') { quote = char; continue; }
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      if (depth === 0) {
        candidates.push(source.slice(start, index + 1));
        break;
      }
    }
  }
  return candidates.sort((a, b) => b.length - a.length);
}

function candidateTexts(text) {
  const raw = String(text || '').trim().replace(/^\uFEFF/, '');
  const fenced = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((match) => match[1].trim());
  return [...new Set([raw, ...fenced, ...balancedObjects(raw)].filter(Boolean))];
}

function parseJsonObject(text) {
  let lastError;
  for (const candidate of candidateTexts(text)) {
    const repaired = candidate
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, '$1');
    try {
      const value = JSON.parse(repaired);
      if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    } catch (error) { lastError = error; }
    try {
      const value = parsePartialJson(repaired);
      if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    } catch (error) { lastError = error; }
  }
  const error = new Error(`No valid JSON object found in local model response${lastError ? `: ${lastError.message}` : ''}`);
  error.code = 'INVALID_MODEL_JSON';
  throw error;
}

module.exports = { balancedObjects, candidateTexts, parseJsonObject };

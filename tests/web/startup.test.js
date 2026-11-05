import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('web startup wiring', () => {
  it('keeps the browser API module outside the /api proxy prefix', () => {
    const app = fs.readFileSync('renderer/app.jsx', 'utf8');
    const viteConfig = fs.readFileSync('vite.config.js', 'utf8');

    expect(fs.existsSync('renderer/lib/apiClient.js')).toBe(true);
    expect(fs.existsSync('renderer/api-client.js')).toBe(false);
    expect(app).toContain("from './lib/apiClient'");
    expect(viteConfig).toContain("'^/api/'");
  });
});

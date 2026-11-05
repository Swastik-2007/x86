import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      'dist/**', 'node_modules/**', 'assets/**', 'site/**', '.claude/**',
      'electron/audio/**', 'electron/calendar/**', 'electron/db/**', 'electron/detection/**',
      'electron/overlay/**', 'electron/utils/**', 'electron/main.js', 'electron/preload.js',
      'electron/overlay-preload.js', 'electron/smoke.js', 'electron/websocket-server.js',
      'electron/services/auto-launch.js', 'electron/services/ffmpeg-installer.js',
      'electron/services/notion.js', 'electron/services/pdf-export.js', 'electron/services/permissions.js',
      'electron/services/transcription.js', 'electron/services/update-policy.js', 'electron/services/updater.js',
      'renderer/components/**', 'renderer/overlay.*', 'renderer/styles/overlay.css',
      'renderer/lib/app-context.js', 'renderer/lib/audioMeter.js', 'renderer/lib/audioTest.js',
      'renderer/lib/browserBridge.js', 'renderer/lib/format.js', 'renderer/lib/greeting.js',
      'renderer/lib/hooks.js', 'renderer/lib/meetingFilters.js', 'renderer/lib/meetingSearch.js',
      'renderer/lib/os.js', 'renderer/lib/platform.js', 'renderer/lib/providers.js',
      'renderer/lib/scrollMemory.js', 'renderer/lib/settingsForm.js', 'renderer/lib/status.js',
      'scripts/after-pack.js', 'scripts/check-smoke.js', 'scripts/dev-electron.js',
      'scripts/fetch-ffmpeg.js', 'scripts/generate-social-preview.js',
    ],
  },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // Node API server, retained provider modules, and build scripts: CommonJS on Node.
  {
    files: ['src/server/**/*.js', 'scripts/**/*.js', '*.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
  {
    files: ['vite.config.js', 'vitest.config.mjs', 'eslint.config.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },

  // Chrome MV3 extension: classic scripts in the page, overlay and popup; the service worker apart.
  {
    files: ['extension/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: {
      // Top-level helpers may share a name with newer DOM globals (e.g. `requestResize`).
      'no-redeclare': ['error', { builtinGlobals: false }],
    },
  },
  {
    files: ['extension/background.js'],
    languageOptions: {
      globals: { ...globals.serviceworker, ...globals.webextensions },
    },
  },

  // React renderer (ES modules, JSX).
  {
    files: ['renderer/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, __APP_VERSION__: 'readonly' },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      // Automatic JSX runtime, but files still `import React` by convention (keeps it "used").
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Apostrophes and quotes in UI copy are fine; only flag characters that are usually typos.
      'react/no-unescaped-entities': ['error', { forbid: ['>', '}'] }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Tests run under Vitest on Node.
  {
    files: ['**/*.test.{js,jsx}'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
];

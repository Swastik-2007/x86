'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const viteBin = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
const children = [
  spawn(process.execPath, ['src/server/index.js'], { stdio: 'inherit' }),
  spawn(process.execPath, [viteBin, '--host', '0.0.0.0'], { stdio: 'inherit' }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
  setTimeout(() => process.exit(code), 100).unref();
}

for (const child of children) child.on('exit', (code, signal) => { if (!stopping) stop(code ?? (signal ? 1 : 0)); });
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

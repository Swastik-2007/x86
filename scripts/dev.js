'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

function findViteBin() {
  const direct = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
  if (fs.existsSync(direct)) return direct;

  // Fallback: locate inside node_modules/.pnpm if symlinks were stripped by UTM shared mount
  const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm');
  if (fs.existsSync(pnpmDir)) {
    const vitePkg = fs.readdirSync(pnpmDir).find((d) => d.startsWith('vite@'));
    if (vitePkg) {
      const candidate = path.join(pnpmDir, vitePkg, 'node_modules', 'vite', 'bin', 'vite.js');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return direct;
}

const viteBin = findViteBin();
const children = [
  spawn(process.execPath, ['src/server/index.js'], { stdio: 'inherit' }),
  spawn(process.execPath, [viteBin, '--host', '0.0.0.0'], { stdio: 'inherit' }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
  }
  setTimeout(() => process.exit(code), 100).unref();
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (!stopping) stop(code ?? (signal ? 1 : 0));
  });
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
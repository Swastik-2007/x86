'use strict';

const { spawn } = require('node:child_process');

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const children = [
  spawn(command, ['run', 'dev:server'], { stdio: 'inherit' }),
  spawn(command, ['run', 'dev:renderer'], { stdio: 'inherit' }),
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

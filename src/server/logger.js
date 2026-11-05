'use strict';

function write(level, message, meta = {}) {
  const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${suffix}`;
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

module.exports = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  debug: (message, meta) => process.env.DEBUG && write('debug', message, meta),
};

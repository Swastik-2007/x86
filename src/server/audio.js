'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function normalizeAudio(inputPath, outputPath, ffmpegPath = '') {
  const executable = ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg';
  return new Promise((resolve, reject) => {
    const args = ['-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', outputPath];
    const child = spawn(executable, args, { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', (error) => {
      if (path.extname(inputPath).toLowerCase() === '.wav') {
        fs.copyFileSync(inputPath, outputPath);
        resolve(outputPath);
        return;
      }
      reject(new Error(`FFmpeg is required to normalize this audio file: ${error.message}`));
    });
    child.once('exit', (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`FFmpeg normalization failed (${code}): ${stderr.slice(-1000)}`));
    });
  });
}

module.exports = { normalizeAudio };

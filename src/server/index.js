'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { WebSocketServer } = require('ws');
const db = require('./database');
const { dataDir, getConfig, updateConfig } = require('./config');
const { runPipeline, parseField } = require('./pipeline');
const { syncToNotion, obsidianExport } = require('./exports');
const { describeProviders, registries } = require('./providers');
const logger = require('./logger');

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3001);
const uploadDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDir),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname || '').toLowerCase() || '.webm'}`),
  }),
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, /^(audio|video)\//.test(file.mimetype) || /\.(webm|wav|mp3|m4a|ogg)$/i.test(file.originalname)),
});

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '5mb' }));

const server = http.createServer(app);
const sockets = new Set();
const wss = new WebSocketServer({ noServer: true });
wss.on('connection', (socket) => {
  sockets.add(socket);
  socket.send(JSON.stringify({ type: 'connected', service: 'manuscript-api' }));
  socket.on('close', () => sockets.delete(socket));
});
server.on('upgrade', (request, socket, head) => {
  if (new URL(request.url, 'http://localhost').pathname !== '/ws') return socket.destroy();
  wss.handleUpgrade(request, socket, head, (client) => wss.emit('connection', client, request));
});
function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const socket of sockets) if (socket.readyState === 1) socket.send(payload);
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'manuscript-api', version: require('../../package.json').version }));
app.get('/api/meetings', (_req, res) => res.json(db.listMeetings()));
app.get('/api/meetings/:id', (req, res) => {
  const meeting = db.getMeeting(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  res.json(meeting);
});

app.post('/api/meetings/upload-audio', upload.single('audio'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'A multipart audio file named “audio” is required' });
  const id = crypto.randomUUID();
  const startedAt = req.body.startedAt || new Date().toISOString();
  const liveNotes = parseField(req.body.liveNotes);
  const captions = parseField(req.body.captions);
  db.createMeeting({ id, title: req.body.title || 'Untitled Meeting', meeting_url: req.body.meetingUrl || '', started_at: startedAt, audio_path: req.file.path, live_notes: liveNotes, captions, status: 'PROCESSING' });
  broadcast({ type: 'processing', meetingId: id, stage: 'uploaded', percent: 1 });
  try {
    const result = await runPipeline({ id, uploadPath: req.file.path, title: req.body.title || 'Untitled Meeting', meetingUrl: req.body.meetingUrl || '', liveNotes, captions, startedAt, config: getConfig(), emit: broadcast });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

app.get('/api/actions', (req, res) => res.json(db.listActions({ status: req.query.status, owner: req.query.owner, meetingId: req.query.meetingId })));
app.patch('/api/actions/:id', (req, res) => {
  if (req.body.status && !['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid action status' });
  const action = db.updateAction(req.params.id, req.body);
  if (!action) return res.status(404).json({ error: 'Action not found' });
  broadcast({ type: 'action-updated', action });
  res.json(action);
});

app.get('/api/settings', (_req, res) => res.json(getConfig()));
app.post('/api/settings', (req, res) => res.json(updateConfig(req.body)));
app.get('/api/providers', (_req, res) => res.json(describeProviders()));
app.post('/api/providers/test', async (req, res, next) => {
  try {
    const registry = req.body.kind === 'stt' ? registries.stt : registries.llm;
    const provider = registry.get(req.body.id);
    const config = { ...getConfig(), ...(req.body.values || {}) };
    const model = registry.resolveModel(provider, req.body.model);
    await provider.test({ config, model });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post('/api/export/notion/:meetingId', async (req, res, next) => {
  try {
    const meeting = db.getMeeting(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    const url = await syncToNotion(meeting, getConfig());
    db.updateMeeting(meeting.id, { notion_page_url: url });
    res.json({ url });
  } catch (error) { next(error); }
});

app.get('/api/export/obsidian/:meetingId', (req, res) => {
  const meeting = db.getMeeting(req.params.meetingId);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  const result = obsidianExport(meeting, getConfig().obsidianVault);
  if (req.query.download === '1') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename.replace(/"/g, '')}"`);
    return res.send(result.markdown);
  }
  res.json(result);
});

app.use((error, _req, res, _next) => {
  logger.error('Request failed', { error: error.message, stack: process.env.DEBUG ? error.stack : undefined });
  res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
});

async function start() {
  await db.initialize();
  server.listen(port, host, () => logger.info(`API listening on http://${host}:${port}`));
}

if (require.main === module) start().catch((error) => { logger.error('Server failed to start', { error: error.message }); process.exit(1); });
module.exports = { app, server, start, broadcast };

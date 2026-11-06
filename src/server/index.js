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
const { runPipeline, regenerateMeeting, parseField } = require('./pipeline');
const { syncToNotion, obsidianExport } = require('./exports');
const { describeProviders, registries } = require('./providers');
const logger = require('./logger');
const { DEFAULT_WHISPER_MODEL, testLocalAi, splitSettings } = require('./local-ai');
const { googleCalendarUrl, ics, actionCalendarEvent, scheduledMeetingCalendarEvent } = require('./calendar');

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

function effectiveConfig() {
  return {
    ...getConfig(), ...db.getSettings(),
    sttService: 'local-whisper', llmProvider: 'lm-studio', localWhisperModel: DEFAULT_WHISPER_MODEL,
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'manuscript-api', version: require('../../package.json').version }));
app.get('/api/meetings', (_req, res) => res.json(db.listMeetings()));
app.get('/api/meetings/:id', (req, res) => {
  const meeting = db.getMeeting(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  res.json(meeting);
});

app.patch('/api/meetings/:id/rename-speaker', (req, res) => {
  const from = String(req.body.from || '').trim();
  const to = String(req.body.to || '').trim();
  if (!from || !to) return res.status(400).json({ error: 'Both “from” and “to” speaker names are required' });
  if (to.length > 80) return res.status(400).json({ error: 'Speaker names must be 80 characters or fewer' });
  const meeting = db.renameSpeaker(req.params.id, from, to);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  broadcast({ type: 'speaker-renamed', meetingId: meeting.id, from, to });
  res.json(meeting);
});

app.post('/api/meetings/upload-audio', upload.single('audio'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'A multipart audio file named “audio” is required' });
  const id = crypto.randomUUID();
  const startedAt = req.body.startedAt || new Date().toISOString();
  const liveNotes = parseField(req.body.liveNotes);
  const captions = parseField(req.body.captions);
  const exportPreferences = parseField(req.body.exportPreferences, {});
  const participants = parseField(req.body.participants);
  if (participants.length) captions.push(...participants.map((speaker) => ({ speaker, text: '', participantOnly: true })));
  db.createMeeting({ id, title: req.body.title || 'Untitled Meeting', meeting_url: req.body.meetingUrl || '', started_at: startedAt, audio_path: req.file.path, live_notes: liveNotes, captions, status: 'PROCESSING' });
  broadcast({ type: 'processing', meetingId: id, stage: 'uploaded', percent: 1 });
  try {
    const config = effectiveConfig();
    config.transcriptionLanguage = req.body.language || config.transcriptionLanguage || 'hinglish';
    const result = await runPipeline({ id, uploadPath: req.file.path, title: req.body.title || 'Untitled Meeting', meetingUrl: req.body.meetingUrl || '', liveNotes, captions, exportPreferences, startedAt, config, emit: broadcast });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

app.post('/api/meetings/:id/summarize', async (req, res, next) => {
  try {
    const result = await regenerateMeeting({ id: req.params.id, config: effectiveConfig(), emit: broadcast });
    if (!result) return res.status(404).json({ error: 'Meeting not found' });
    res.json(result);
  } catch (error) { next(error); }
});

app.post('/api/meetings/from-captions', async (req, res, next) => {
  const captions = parseField(req.body.captions);
  if (!captions.length) return res.status(400).json({ error: 'At least one caption is required' });
  const id = crypto.randomUUID();
  const title = req.body.title || 'Captioned Meeting';
  const startedAt = req.body.startedAt || new Date().toISOString();
  const liveNotes = parseField(req.body.liveNotes);
  db.createMeeting({ id, title, meeting_url: req.body.meetingUrl || '', started_at: startedAt, live_notes: liveNotes, captions, status: 'PROCESSING' });
  try {
    const result = await runPipeline({ id, uploadPath: null, title, meetingUrl: req.body.meetingUrl || '', liveNotes, captions, startedAt, config: effectiveConfig(), emit: broadcast });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

const actionStatuses = ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'];
const actionPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

app.get('/api/actions', (req, res) => res.json(db.listActions({
  status: req.query.status, owner: req.query.owner, meetingId: req.query.meetingId, priority: req.query.priority,
})));
app.post('/api/actions', (req, res) => {
  if (!String(req.body.task || '').trim()) return res.status(400).json({ error: 'Action task is required' });
  if (req.body.status && !actionStatuses.includes(req.body.status)) return res.status(400).json({ error: 'Invalid action status' });
  if (req.body.priority && !actionPriorities.includes(req.body.priority)) return res.status(400).json({ error: 'Invalid action priority' });
  if (req.body.meetingId && !db.getMeeting(req.body.meetingId)) return res.status(400).json({ error: 'Selected meeting was not found' });
  const action = db.createAction(req.body);
  broadcast({ type: 'action-updated', action });
  res.status(201).json(action);
});
app.patch('/api/actions/:id', (req, res) => {
  if (req.body.status && !actionStatuses.includes(req.body.status)) return res.status(400).json({ error: 'Invalid action status' });
  if (req.body.priority && !actionPriorities.includes(req.body.priority)) return res.status(400).json({ error: 'Invalid action priority' });
  const action = db.updateAction(req.params.id, req.body);
  if (!action) return res.status(404).json({ error: 'Action not found' });
  broadcast({ type: 'action-updated', action });
  res.json(action);
});
app.delete('/api/actions/:id', (req, res) => {
  const action = db.deleteAction(req.params.id);
  if (!action) return res.status(404).json({ error: 'Action not found' });
  broadcast({ type: 'action-updated', actionId: req.params.id, deleted: true });
  res.status(204).end();
});
app.get('/api/actions/:id/calendar', (req, res, next) => {
  try {
    const action = db.getAction(req.params.id);
    if (!action) return res.status(404).json({ error: 'Action not found' });
    const event = actionCalendarEvent(action);
    if (req.query.download === '1') {
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="action-${action.id}.ics"`);
      return res.send(ics(event));
    }
    res.json({ googleCalendarUrl: googleCalendarUrl(event), icsUrl: `/api/actions/${encodeURIComponent(action.id)}/calendar?download=1` });
  } catch (error) { next(error); }
});
app.post('/api/actions/:id/export/notion', async (req, res, next) => {
  try {
    const action = db.getAction(req.params.id);
    if (!action) return res.status(404).json({ error: 'Action not found' });
    if (!action.meeting_id) return res.status(400).json({ error: 'Standalone actions must be linked to a meeting before export' });
    const meeting = db.getMeeting(action.meeting_id);
    const url = await syncToNotion(meeting, effectiveConfig());
    db.updateMeeting(meeting.id, { notion_page_url: url });
    res.json({ url });
  } catch (error) { next(error); }
});
app.get('/api/actions/:id/export/obsidian', (req, res) => {
  const action = db.getAction(req.params.id);
  if (!action) return res.status(404).json({ error: 'Action not found' });
  if (!action.meeting_id) return res.status(400).json({ error: 'Standalone actions must be linked to a meeting before export' });
  res.json(obsidianExport(db.getMeeting(action.meeting_id), effectiveConfig().obsidianVault));
});

app.get('/api/calendar', (req, res) => res.json(db.listScheduledMeetings({ from: req.query.from, to: req.query.to })));
app.post('/api/calendar', (req, res) => {
  if (!String(req.body.title || '').trim() || !req.body.startAt) return res.status(400).json({ error: 'Title and start time are required' });
  const start = new Date(req.body.startAt);
  if (Number.isNaN(start.getTime())) return res.status(400).json({ error: 'Start time must be a valid date' });
  const meeting = db.createScheduledMeeting({ ...req.body, startAt: start.toISOString() });
  broadcast({ type: 'calendar-updated', meeting });
  res.status(201).json(meeting);
});
app.get('/api/calendar/:id', (req, res) => {
  const meeting = db.getScheduledMeeting(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Scheduled meeting not found' });
  res.json(meeting);
});
app.patch('/api/calendar/:id', (req, res) => {
  if (req.body.startAt && Number.isNaN(new Date(req.body.startAt).getTime())) return res.status(400).json({ error: 'Start time must be a valid date' });
  const patch = req.body.startAt ? { ...req.body, startAt: new Date(req.body.startAt).toISOString() } : req.body;
  const meeting = db.updateScheduledMeeting(req.params.id, patch);
  if (!meeting) return res.status(404).json({ error: 'Scheduled meeting not found' });
  broadcast({ type: 'calendar-updated', meeting });
  res.json(meeting);
});
app.delete('/api/calendar/:id', (req, res) => {
  const meeting = db.deleteScheduledMeeting(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Scheduled meeting not found' });
  broadcast({ type: 'calendar-updated', meetingId: req.params.id, deleted: true });
  res.status(204).end();
});
app.get('/api/calendar/:id/export', (req, res, next) => {
  try {
    const meeting = db.getScheduledMeeting(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Scheduled meeting not found' });
    const event = scheduledMeetingCalendarEvent(meeting);
    if (req.query.download === '1') {
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${meeting.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'meeting'}.ics"`);
      return res.send(ics(event));
    }
    res.json({ googleCalendarUrl: googleCalendarUrl(event), icsUrl: `/api/calendar/${encodeURIComponent(meeting.id)}/export?download=1` });
  } catch (error) { next(error); }
});

app.get('/api/settings', (_req, res) => res.json(effectiveConfig()));
app.post('/api/settings', (req, res) => {
  const updates = splitSettings(req.body);
  updateConfig(updates.config);
  db.updateSettings(updates.local);
  res.json(effectiveConfig());
});
app.post('/api/local-ai/test', async (req, res) => {
  const candidate = { ...effectiveConfig(), ...(req.body || {}) };
  res.json(await testLocalAi(candidate));
});
app.post('/api/settings/test-local-ai', async (req, res) => {
  const candidate = { ...effectiveConfig(), ...(req.body || {}) };
  const result = await testLocalAi(candidate);
  if (Object.keys(result.settings).length) db.updateSettings(result.settings);
  res.json({ ...result, savedSettings: effectiveConfig() });
});
app.get('/api/providers', (_req, res) => res.json(describeProviders()));
app.post('/api/providers/test', async (req, res, next) => {
  try {
    const registry = req.body.kind === 'stt' ? registries.stt : registries.llm;
    const provider = registry.get(req.body.id);
    const config = { ...effectiveConfig(), ...(req.body.values || {}) };
    const model = registry.resolveModel(provider, req.body.model);
    await provider.test({ config, model });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post('/api/export/notion/:meetingId', async (req, res, next) => {
  try {
    const meeting = db.getMeeting(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    const url = await syncToNotion(meeting, effectiveConfig());
    db.updateMeeting(meeting.id, { notion_page_url: url });
    res.json({ url });
  } catch (error) { next(error); }
});

app.get('/api/export/obsidian/:meetingId', (req, res) => {
  const meeting = db.getMeeting(req.params.meetingId);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  const result = obsidianExport(meeting, effectiveConfig().obsidianVault);
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

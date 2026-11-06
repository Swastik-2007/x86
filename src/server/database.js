'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const initSqlJs = require('sql.js');
const { dataDir } = require('./config');

const dbPath = path.join(dataDir, 'manuscript.db');
let db;

function persist() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

async function initialize() {
  const SQL = await initSqlJs();
  db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, meeting_url TEXT, started_at TEXT, ended_at TEXT,
      duration_seconds INTEGER, audio_path TEXT, transcript TEXT NOT NULL DEFAULT '[]', structured TEXT,
      live_notes TEXT NOT NULL DEFAULT '[]', captions TEXT NOT NULL DEFAULT '[]', notion_page_url TEXT,
      status TEXT NOT NULL, last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_meetings_started_at ON meetings(started_at DESC);
    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY, meeting_id TEXT, task TEXT NOT NULL, owner TEXT NOT NULL DEFAULT 'Unassigned',
      priority TEXT NOT NULL DEFAULT 'MEDIUM', deadline TEXT, status TEXT NOT NULL DEFAULT 'PENDING', source_quote TEXT,
      source_timestamp TEXT, created_at TEXT NOT NULL,
      FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scheduled_meetings (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, start_at TEXT NOT NULL, duration_minutes INTEGER NOT NULL DEFAULT 30,
      meet_url TEXT, participants TEXT NOT NULL DEFAULT '[]', agenda TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_start ON scheduled_meetings(start_at);
  `);
  migrateActions();
  persist();
}

function migrateActions() {
  const columns = rows('PRAGMA table_info(actions)');
  const meetingId = columns.find((column) => column.name === 'meeting_id');
  if (columns.some((column) => column.name === 'source_quote') && meetingId?.notnull === 0) return;
  const database = ensure();
  database.run('BEGIN');
  try {
    database.run(`CREATE TABLE actions_next (
      id TEXT PRIMARY KEY, meeting_id TEXT, task TEXT NOT NULL, owner TEXT NOT NULL DEFAULT 'Unassigned',
      priority TEXT NOT NULL DEFAULT 'MEDIUM', deadline TEXT, status TEXT NOT NULL DEFAULT 'PENDING', source_quote TEXT,
      source_timestamp TEXT, created_at TEXT NOT NULL,
      FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    )`);
    database.run(`INSERT INTO actions_next (id, meeting_id, task, owner, priority, deadline, status, source_quote, source_timestamp, created_at)
      SELECT id, meeting_id, task, owner, priority, deadline, status,
      ${columns.some((column) => column.name === 'source_quote') ? 'source_quote' : 'NULL'},
      ${columns.some((column) => column.name === 'source_timestamp') ? 'source_timestamp' : 'NULL'}, created_at FROM actions`);
    database.run('DROP TABLE actions');
    database.run('ALTER TABLE actions_next RENAME TO actions');
    database.run('CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status)');
    database.run('COMMIT');
  } catch (error) {
    database.run('ROLLBACK');
    throw error;
  }
}

function ensure() { if (!db) throw new Error('Database has not been initialized'); return db; }
function rows(sql, values = []) {
  const statement = ensure().prepare(sql);
  statement.bind(values);
  const result = [];
  while (statement.step()) result.push(statement.getAsObject());
  statement.free();
  return result;
}
function parse(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
function hydrateMeeting(row) {
  if (!row) return null;
  const structured = parse(row.structured, null);
  return {
    ...row,
    transcript: parse(row.transcript, []), structured, live_notes: parse(row.live_notes, []), captions: parse(row.captions, []),
    summary: structured?.summary || '', topics: structured?.topics || [], attendees: structured?.attendees || [],
    decisions: structured?.decisions || [], action_items: structured?.action_items || [],
  };
}

function createMeeting(meeting) {
  ensure().run(
    `INSERT INTO meetings (id, title, meeting_url, started_at, ended_at, duration_seconds, audio_path, transcript, structured, live_notes, captions, status, last_error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [meeting.id, meeting.title, meeting.meeting_url || null, meeting.started_at, meeting.ended_at || null,
      meeting.duration_seconds || null, meeting.audio_path || null, JSON.stringify(meeting.transcript || []),
      meeting.structured ? JSON.stringify(meeting.structured) : null, JSON.stringify(meeting.live_notes || []),
      JSON.stringify(meeting.captions || []), meeting.status || 'PROCESSING', meeting.last_error || null]
  );
  persist();
  return getMeeting(meeting.id);
}

function updateMeeting(id, updates) {
  const allowed = new Set(['title', 'meeting_url', 'started_at', 'ended_at', 'duration_seconds', 'audio_path', 'transcript', 'structured', 'live_notes', 'captions', 'notion_page_url', 'status', 'last_error']);
  const entries = Object.entries(updates).filter(([key]) => allowed.has(key));
  if (!entries.length) return getMeeting(id);
  const values = entries.map(([key, value]) => ['transcript', 'structured', 'live_notes', 'captions'].includes(key) ? JSON.stringify(value) : value);
  ensure().run(`UPDATE meetings SET ${entries.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ?`, [...values, id]);
  persist();
  return getMeeting(id);
}

function getMeeting(id) {
  const meeting = hydrateMeeting(rows('SELECT * FROM meetings WHERE id = ?', [id])[0]);
  if (meeting) {
    meeting.actions = listActions({ meetingId: id });
    meeting.action_items = meeting.actions;
  }
  return meeting;
}
function listMeetings() { return rows('SELECT * FROM meetings ORDER BY started_at DESC').map(hydrateMeeting); }

function replaceActions(meetingId, actions) {
  const database = ensure();
  database.run('DELETE FROM actions WHERE meeting_id = ?', [meetingId]);
  for (const action of actions) {
    database.run(`INSERT INTO actions (id, meeting_id, task, owner, priority, deadline, status, source_quote, source_timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [action.id, meetingId, action.task, action.owner || 'Unassigned', action.priority || 'MEDIUM', action.deadline || null,
        action.status || 'PENDING', action.source_quote || action.quote || null, action.source_timestamp || action.timestamp || null,
        action.created_at || new Date().toISOString()]);
  }
  persist();
  return listActions({ meetingId });
}

function listActions({ status, owner, meetingId, priority } = {}) {
  const clauses = [];
  const values = [];
  if (status) { clauses.push('a.status = ?'); values.push(status); }
  if (owner) { clauses.push('LOWER(a.owner) = LOWER(?)'); values.push(owner); }
  if (meetingId) { clauses.push('a.meeting_id = ?'); values.push(meetingId); }
  if (priority) { clauses.push('a.priority = ?'); values.push(priority); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return rows(`SELECT a.*, m.title AS meeting_title FROM actions a LEFT JOIN meetings m ON m.id = a.meeting_id ${where}
    ORDER BY CASE a.status WHEN 'PENDING' THEN 0 WHEN 'IN_PROGRESS' THEN 1 WHEN 'BLOCKED' THEN 2 ELSE 3 END, a.created_at DESC`, values);
}

function getAction(id) { return listActions().find((action) => action.id === id) || null; }

function normalizeActionInput(input = {}) {
  return {
    id: input.id || crypto.randomUUID(), meeting_id: input.meetingId || input.meeting_id || null,
    task: String(input.task || '').trim(), owner: String(input.owner || 'Unassigned').trim() || 'Unassigned',
    priority: input.priority || 'MEDIUM', deadline: input.deadline || null, status: input.status || 'PENDING',
    source_quote: input.sourceQuote || input.source_quote || null,
    source_timestamp: input.sourceTimestamp || input.source_timestamp || null,
    created_at: input.createdAt || input.created_at || new Date().toISOString(),
  };
}

function createAction(input) {
  const action = normalizeActionInput(input);
  if (!action.task) throw new Error('Action task is required');
  ensure().run(`INSERT INTO actions (id, meeting_id, task, owner, priority, deadline, status, source_quote, source_timestamp, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, Object.values(action));
  persist();
  return getAction(action.id);
}

function updateAction(id, patch) {
  const allowed = new Set(['task', 'owner', 'priority', 'deadline', 'status', 'source_quote', 'source_timestamp']);
  const entries = Object.entries(patch || {}).filter(([key]) => allowed.has(key));
  if (entries.length) {
    ensure().run(`UPDATE actions SET ${entries.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ?`, [...entries.map(([, value]) => value), id]);
    persist();
  }
  return rows('SELECT * FROM actions WHERE id = ?', [id])[0] || null;
}

function deleteAction(id) {
  const action = rows('SELECT * FROM actions WHERE id = ?', [id])[0] || null;
  if (!action) return null;
  ensure().run('DELETE FROM actions WHERE id = ?', [id]);
  persist();
  return action;
}

function replaceSpeakerReferences(value, from, to) {
  if (Array.isArray(value)) return value.map((item) => replaceSpeakerReferences(item, from, to));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceSpeakerReferences(item, from, to)]));
  if (typeof value !== 'string') return value;
  const escaped = String(from).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return value.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), to);
}

function renameSpeaker(meetingId, from, to) {
  const meeting = getMeeting(meetingId);
  if (!meeting) return null;
  const source = String(from || '').trim();
  const target = String(to || '').trim();
  if (!source || !target) throw new Error('Both current and new speaker names are required');
  const database = ensure();
  database.run('BEGIN');
  try {
    const transcript = replaceSpeakerReferences(meeting.transcript, source, target);
    const structured = replaceSpeakerReferences(meeting.structured, source, target);
    const captions = replaceSpeakerReferences(meeting.captions, source, target);
    const liveNotes = replaceSpeakerReferences(meeting.live_notes, source, target);
    database.run('UPDATE meetings SET transcript = ?, structured = ?, captions = ?, live_notes = ? WHERE id = ?', [
      JSON.stringify(transcript), JSON.stringify(structured), JSON.stringify(captions), JSON.stringify(liveNotes), meetingId,
    ]);
    database.run('UPDATE actions SET owner = ? WHERE meeting_id = ? AND LOWER(owner) = LOWER(?)', [target, meetingId, source]);
    database.run('COMMIT');
    persist();
    return getMeeting(meetingId);
  } catch (error) {
    database.run('ROLLBACK');
    throw error;
  }
}

function getSettings() {
  return Object.fromEntries(rows('SELECT key, value FROM settings').map((row) => [row.key, parse(row.value, row.value)]));
}

function updateSettings(updates) {
  const database = ensure();
  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(updates || {})) {
    database.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value), now]
    );
  }
  persist();
  return getSettings();
}

function hydrateScheduledMeeting(row) {
  return row ? { ...row, participants: parse(row.participants, []) } : null;
}

function listScheduledMeetings({ from, to } = {}) {
  const clauses = [];
  const values = [];
  if (from) { clauses.push('start_at >= ?'); values.push(from); }
  if (to) { clauses.push('start_at <= ?'); values.push(to); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return rows(`SELECT * FROM scheduled_meetings ${where} ORDER BY start_at ASC`, values).map(hydrateScheduledMeeting);
}

function getScheduledMeeting(id) {
  return hydrateScheduledMeeting(rows('SELECT * FROM scheduled_meetings WHERE id = ?', [id])[0]);
}

function normalizeScheduledMeetingInput(input = {}, now = new Date().toISOString()) {
  return {
    id: input.id || crypto.randomUUID(), title: String(input.title || '').trim(), start_at: input.startAt || input.start_at,
    duration_minutes: Math.max(5, Number(input.durationMinutes || input.duration_minutes || 30)),
    meet_url: String(input.meetUrl || input.meet_url || '').trim() || null,
    participants: Array.isArray(input.participants) ? input.participants.filter(Boolean) : [],
    agenda: String(input.agenda || '').trim() || null, created_at: input.createdAt || now, updated_at: now,
  };
}

function createScheduledMeeting(input) {
  const meeting = normalizeScheduledMeetingInput(input);
  if (!meeting.title || !meeting.start_at) throw new Error('Scheduled meetings require a title and start time');
  ensure().run(`INSERT INTO scheduled_meetings (id, title, start_at, duration_minutes, meet_url, participants, agenda, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [meeting.id, meeting.title, meeting.start_at, meeting.duration_minutes, meeting.meet_url,
    JSON.stringify(meeting.participants), meeting.agenda, meeting.created_at, meeting.updated_at]);
  persist();
  return getScheduledMeeting(meeting.id);
}

function updateScheduledMeeting(id, patch) {
  const fields = { title: 'title', startAt: 'start_at', start_at: 'start_at', durationMinutes: 'duration_minutes', duration_minutes: 'duration_minutes', meetUrl: 'meet_url', meet_url: 'meet_url', participants: 'participants', agenda: 'agenda' };
  const entries = Object.entries(patch || {}).filter(([key]) => fields[key]).map(([key, value]) => [fields[key], key === 'participants' ? JSON.stringify(value || []) : value]);
  if (entries.length) {
    entries.push(['updated_at', new Date().toISOString()]);
    ensure().run(`UPDATE scheduled_meetings SET ${entries.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ?`, [...entries.map(([, value]) => value), id]);
    persist();
  }
  return getScheduledMeeting(id);
}

function deleteScheduledMeeting(id) {
  const meeting = getScheduledMeeting(id);
  if (!meeting) return null;
  ensure().run('DELETE FROM scheduled_meetings WHERE id = ?', [id]);
  persist();
  return meeting;
}

module.exports = { initialize, createMeeting, updateMeeting, getMeeting, listMeetings, replaceActions, listActions, getAction, createAction, updateAction, deleteAction, normalizeActionInput, renameSpeaker, replaceSpeakerReferences, getSettings, updateSettings, normalizeScheduledMeetingInput, listScheduledMeetings, getScheduledMeeting, createScheduledMeeting, updateScheduledMeeting, deleteScheduledMeeting };

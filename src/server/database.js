'use strict';

const fs = require('node:fs');
const path = require('node:path');
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
      id TEXT PRIMARY KEY, meeting_id TEXT NOT NULL, task TEXT NOT NULL, owner TEXT NOT NULL DEFAULT 'Unassigned',
      priority TEXT NOT NULL DEFAULT 'MEDIUM', deadline TEXT, status TEXT NOT NULL DEFAULT 'PENDING', created_at TEXT NOT NULL,
      FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
  `);
  persist();
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
  return { ...row, transcript: parse(row.transcript, []), structured: parse(row.structured, null), live_notes: parse(row.live_notes, []), captions: parse(row.captions, []) };
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
  if (meeting) meeting.actions = listActions({ meetingId: id });
  return meeting;
}
function listMeetings() { return rows('SELECT * FROM meetings ORDER BY started_at DESC').map(hydrateMeeting); }

function replaceActions(meetingId, actions) {
  const database = ensure();
  database.run('DELETE FROM actions WHERE meeting_id = ?', [meetingId]);
  for (const action of actions) {
    database.run(`INSERT INTO actions (id, meeting_id, task, owner, priority, deadline, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [action.id, meetingId, action.task, action.owner || 'Unassigned', action.priority || 'MEDIUM', action.deadline || null,
        action.status || 'PENDING', action.created_at || new Date().toISOString()]);
  }
  persist();
  return listActions({ meetingId });
}

function listActions({ status, owner, meetingId } = {}) {
  const clauses = [];
  const values = [];
  if (status) { clauses.push('a.status = ?'); values.push(status); }
  if (owner) { clauses.push('LOWER(a.owner) = LOWER(?)'); values.push(owner); }
  if (meetingId) { clauses.push('a.meeting_id = ?'); values.push(meetingId); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return rows(`SELECT a.*, m.title AS meeting_title FROM actions a JOIN meetings m ON m.id = a.meeting_id ${where}
    ORDER BY CASE a.status WHEN 'PENDING' THEN 0 WHEN 'IN_PROGRESS' THEN 1 ELSE 2 END, a.created_at DESC`, values);
}

function updateAction(id, patch) {
  const allowed = new Set(['task', 'owner', 'priority', 'deadline', 'status']);
  const entries = Object.entries(patch || {}).filter(([key]) => allowed.has(key));
  if (entries.length) {
    ensure().run(`UPDATE actions SET ${entries.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ?`, [...entries.map(([, value]) => value), id]);
    persist();
  }
  return rows('SELECT * FROM actions WHERE id = ?', [id])[0] || null;
}

module.exports = { initialize, createMeeting, updateMeeting, getMeeting, listMeetings, replaceActions, listActions, updateAction };

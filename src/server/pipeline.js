'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const { sttRegistry } = require('./providers');
const { generateNotes } = require('./notes/notes');
const { normalizeAudio } = require('./audio');
const db = require('./database');
const { syncToNotion, obsidianExport } = require('./exports');

const P8_PROMPT = `You are Manuscript, a meeting intelligence engine. Return only valid JSON. Write clear, neutral English even when the meeting code-switches between languages. Preserve evidence for decisions and make every responsibility actionable.

Required JSON shape:
{
  "title": "short meeting title",
  "summary": "executive overview",
  "attendees": [{"label":"speaker label","name":"name if known","role":"role if known"}],
  "topics": [{"heading":"topic","content":"complete discussion summary"}],
  "decisions": [{"decision":"what was decided","quote":"exact supporting transcript quote","timestamp":"MM:SS","context":"why it matters"}],
  "action_items": [{"task":"specific task","owner":"person or Unassigned","priority":"HIGH|MEDIUM|LOW","deadline":"YYYY-MM-DD or null"}]
}

Do not invent decisions, owners, quotes, timestamps, or deadlines. Use an empty array when evidence is absent.`;

function parseField(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function captionTranscript(captions) {
  return captions.map((caption, index) => ({
    speaker: caption.speaker || 'Google Meet caption',
    text: caption.text || String(caption),
    startTime: Number(caption.startTime ?? caption.timestamp ?? index) || 0,
    endTime: Number(caption.endTime ?? caption.startTime ?? caption.timestamp ?? index) || 0,
  })).filter((segment) => segment.text.trim());
}

function isGenericSpeaker(value) {
  return /^(?:speaker|guest|user|participant|google meet caption)(?:\s*\d+)?$/i.test(String(value || '').trim());
}

function mergeCaptionNames(transcript, captions) {
  const named = captionTranscript(captions).filter((segment) => !isGenericSpeaker(segment.speaker));
  const hints = [...new Set((captions || []).filter((caption) => caption.participantOnly).map((caption) => String(caption.speaker || '').trim()).filter(Boolean))];
  if (!transcript.length) return captionTranscript(captions);
  const genericLabels = [...new Set(transcript.map((segment) => segment.speaker).filter(isGenericSpeaker))];
  const hintByLabel = new Map(genericLabels.map((label, index) => [label, hints[index]]).filter(([, hint]) => hint));
  return transcript.map((segment) => {
    const start = Number(segment.startTime) || 0;
    const match = named.reduce((best, caption) => {
      const distance = Math.abs((Number(caption.startTime) || 0) - start);
      return !best || distance < best.distance ? { caption, distance } : best;
    }, null);
    if (match && match.distance <= 8 && isGenericSpeaker(segment.speaker)) return { ...segment, speaker: match.caption.speaker };
    const hint = hintByLabel.get(segment.speaker);
    return hint ? { ...segment, speaker: hint } : segment;
  });
}

function normalizedActions(notes) {
  const result = [];
  for (const item of notes.action_items || notes.actions || []) {
    if (Array.isArray(item.tasks)) {
      for (const task of item.tasks) result.push({ task, owner: item.owner, priority: item.priority, deadline: item.deadline });
    } else result.push({ task: item.task || item.description || String(item), owner: item.owner || item.assignee, priority: item.priority, deadline: item.deadline || item.due_date });
  }
  return result.filter((item) => item.task).map((item) => ({
    id: crypto.randomUUID(), task: String(item.task).trim(), owner: String(item.owner || 'Unassigned').trim(),
    priority: ['HIGH', 'MEDIUM', 'LOW'].includes(String(item.priority).toUpperCase()) ? String(item.priority).toUpperCase() : 'MEDIUM',
    deadline: item.deadline && item.deadline !== 'null' ? String(item.deadline) : null, status: 'PENDING',
  }));
}

function structuredNotes(notes) {
  return {
    title: notes.title || 'Untitled Meeting',
    summary: notes.summary || notes.executive_summary || notes.overview || '',
    attendees: Array.isArray(notes.attendees) ? notes.attendees : [],
    topics: notes.topics || notes.sections || [],
    decisions: (notes.decisions || notes.key_decisions || []).map((item) => typeof item === 'string' ? { decision: item, quote: '', timestamp: '', context: '' } : item),
    provider: notes._llmProvider || null,
    model: notes._llmModel || null,
  };
}

async function runPipeline({ id, uploadPath, title, meetingUrl: _meetingUrl, liveNotes, captions, exportPreferences = {}, startedAt: _startedAt, config, emit }) {
  const wavPath = uploadPath ? path.join(path.dirname(uploadPath), `${id}.wav`) : null;
  const notify = (stage, percent, extra = {}) => emit({ type: 'processing', meetingId: id, stage, percent, ...extra });
  try {
    let transcript;
    if (!uploadPath) {
      transcript = captionTranscript(captions);
      if (!transcript.length) throw new Error('Caption-only processing requires at least one caption');
      notify('transcribing', 50, { source: 'captions' });
    } else {
      notify('normalizing', 5);
      await normalizeAudio(uploadPath, wavPath, config.ffmpegPath);
      db.updateMeeting(id, { audio_path: wavPath });

      notify('transcribing', 15);
      const provider = sttRegistry.get(config.sttService || sttRegistry.defaultId());
      const model = sttRegistry.resolveModel(provider, config.sttModels?.[provider.id]);
      try {
        transcript = await provider.transcribe({
          wavPath, model, config,
          onProgress: (fraction) => notify('transcribing', 15 + Math.round((Number(fraction) || 0) * 35)),
        });
        transcript = mergeCaptionNames(transcript, captions);
      } catch (error) {
        const fallback = captionTranscript(captions);
        if (!fallback.length) throw error;
        transcript = fallback;
        notify('transcribing', 50, { warning: `Audio transcription failed; using captured captions: ${error.message}` });
      }
    }
    db.updateMeeting(id, { transcript });

    notify('summarizing', 55);
    const liveContext = liveNotes.map((note) => ({ speaker: 'Live note', text: note.text || String(note), startTime: Number(note.timestamp) || 0, endTime: Number(note.timestamp) || 0 }));
    const result = await generateNotes([...transcript, ...liveContext], { ...config, systemPrompt: config.systemPrompt || P8_PROMPT, noteOutputMode: 'json' }, {
      meetingTitle: title,
      onPreview: ({ progress }) => notify('summarizing', 55 + Math.round((Number(progress) || 0) * 30)),
    });
    result.notes._llmProvider = result.provider;
    result.notes._llmModel = result.model;
    const structured = structuredNotes(result.notes);
    const finalTitle = title && title !== 'Untitled Meeting' ? title : structured.title;
    db.updateMeeting(id, { title: finalTitle, structured, ended_at: new Date().toISOString(), status: 'COMPLETE', last_error: null });
    const actions = db.replaceActions(id, normalizedActions(result.notes));
    let meeting = db.getMeeting(id);

    const exports = { obsidian: obsidianExport(meeting, config.obsidianVault) };
    if ((exportPreferences.notion || config.autoSyncExports) && config.notionToken && config.notionDatabaseId) {
      notify('exporting', 92);
      try {
        exports.notionUrl = await syncToNotion(meeting, config);
        meeting = db.updateMeeting(id, { notion_page_url: exports.notionUrl });
      } catch (error) {
        exports.notionError = error.message;
      }
    }
    notify('complete', 100, { meeting, actions, exports });
    return { meeting: db.getMeeting(id), actions, exports };
  } catch (error) {
    db.updateMeeting(id, { status: 'ERROR', last_error: error.message, ended_at: new Date().toISOString() });
    emit({ type: 'processing-error', meetingId: id, error: error.message });
    throw error;
  }
}

module.exports = { runPipeline, P8_PROMPT, structuredNotes, normalizedActions, parseField, captionTranscript, mergeCaptionNames };

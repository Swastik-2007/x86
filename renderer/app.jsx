import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CalendarDays, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, Cpu, Download, ExternalLink, FileAudio, ListChecks, Mic, Plus, Puzzle, Settings as SettingsIcon, Trash2, Upload, Users, Workflow } from 'lucide-react';
import { api } from './lib/apiClient';
import { startBrowserRecording } from './lib/browserRecorder';

const STATUSES = ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'];
const statusNames = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', BLOCKED: 'Blocked', COMPLETED: 'Completed' };
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function showToast(message) {
  window.dispatchEvent(new CustomEvent('manuscript-toast', { detail: message }));
}

function ToastRegion() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    let timer;
    const receive = (event) => { setMessage(String(event.detail || '')); clearTimeout(timer); timer = setTimeout(() => setMessage(''), 3600); };
    window.addEventListener('manuscript-toast', receive);
    return () => { clearTimeout(timer); window.removeEventListener('manuscript-toast', receive); };
  }, []);
  return message ? <div className="toast" role="status" aria-live="polite">{message}</div> : null;
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function Nav({ view, setView }) {
  return <header className="topbar">
    <button className="brand" onClick={() => setView('dashboard')}><span className="brand-mark"><Mic size={18} /></span><span>Manuscript</span></button>
    <nav aria-label="Primary navigation">
      <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Meetings</button>
      <button className={view === 'actions' ? 'active' : ''} onClick={() => setView('actions')}><ListChecks size={16} /> Action Tracker</button>
      <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={16} /> Calendar</button>
      <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}><SettingsIcon size={16} /> Settings</button>
      <button className={view === 'how' ? 'active' : ''} onClick={() => setView('how')} title="Open setup help and permission checks"><BookOpen size={16} /> How It Works</button>
    </nav>
  </header>;
}

function CaptureCard({ busy, progress, onProcessed }) {
  const [recording, setRecording] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const processFile = async (file, metadata = {}) => {
    setError('');
    try {
      const result = await api.meetings.upload(file, { title: title || file.name.replace(/\.[^.]+$/, ''), ...metadata });
      showToast('Audio uploaded. Manuscript is processing the meeting.');
      await onProcessed(result.meeting);
    } catch (uploadError) { setError(uploadError.message); }
  };

  const start = async (includeTab) => {
    setError('');
    try {
      setRecording(await startBrowserRecording({ includeTab }));
      setStartedAt(new Date().toISOString());
    } catch (captureError) { setError(captureError.message); }
  };

  const stop = async () => {
    const active = recording;
    setRecording(null);
    try {
      const blob = await active.stop();
      await processFile(new File([blob], `manuscript-${Date.now()}.webm`, { type: blob.type }), { startedAt });
    } catch (captureError) { setError(captureError.message); }
  };

  return <section className="capture-card" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const [file] = event.dataTransfer.files; if (file) processFile(file); }}>
    <div><span className="eyebrow">1 · Capture</span><h2>{recording ? 'Recording in this browser' : 'Turn the meeting into decisions'}</h2><p>Record microphone and shared-tab audio, or drop an existing WebM, MP3, WAV, M4A, or OGG file.</p></div>
    <label className="field"><span>Meeting title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Weekly product review" /></label>
    {progress && <div className="progress"><div style={{ width: `${progress.percent}%` }} /><span>{progress.stage} · {progress.percent}%</span></div>}
    <div className="capture-actions">
      {recording
        ? <button className="primary" onClick={stop} title="Stop capture and send this recording to the backend">Stop & process</button>
        : <button className="primary" disabled={busy} onClick={() => start(true)} title="Record the chosen browser tab and your microphone"><Mic size={17} /> Record tab + mic</button>}
      {!recording && <button className="ghost" disabled={busy} onClick={() => start(false)} title="Record only your microphone in this browser">Mic only</button>}
      {!recording && <button className="ghost" disabled={busy} onClick={() => fileRef.current?.click()} title="Upload an existing meeting recording"><Upload size={17} /> Upload audio</button>}
      <input ref={fileRef} type="file" accept="audio/*,video/webm" hidden onChange={(event) => event.target.files[0] && processFile(event.target.files[0])} />
    </div>
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}

function Dashboard({ meetings, progress, openMeeting, refresh }) {
  return <main className="page">
    <section className="hero"><span className="eyebrow">P8 · Meeting Intelligence</span><h1>Every discussion becomes an accountable record.</h1><p>Structured summaries, evidence-backed decisions, assigned responsibilities, and one global pending-action tracker.</p></section>
    <CaptureCard busy={Boolean(progress)} progress={progress} onProcessed={async (meeting) => { await refresh(); openMeeting(meeting.id); }} />
    <section><div className="section-title"><div><span className="eyebrow">2 · Review</span><h2>Recent meetings</h2></div><span className="count">{meetings.length}</span></div>
      <div className="meeting-grid">{meetings.length ? meetings.map((meeting) => <button className="meeting-card" key={meeting.id} onClick={() => openMeeting(meeting.id)}>
        <div className={`status-dot ${meeting.status.toLowerCase()}`} /><div><h3>{meeting.title}</h3><p>{formatDate(meeting.started_at)}</p><span>{meeting.structured?.decisions?.length || 0} decisions · {meeting.status}</span></div>
      </button>) : <div className="empty"><FileAudio size={30} /><h3>No meetings yet</h3><p>Record in the browser, upload audio, or use the Chrome extension in Google Meet.</p></div>}</div>
    </section>
  </main>;
}

function MeetingView({ meeting, back, refresh, settings }) {
  const [notice, setNotice] = useState('');
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
  if (!meeting) return <main className="page"><div className="empty">Loading meeting…</div></main>;
  const speakers = [...new Set([
    ...(meeting.transcript || []).map((segment) => segment.speaker),
    ...(meeting.structured?.attendees || []).flatMap((attendee) => typeof attendee === 'string' ? [attendee] : [attendee.name, attendee.label]),
  ].filter(Boolean))];
  const knownNames = [...new Set([settings?.userName, ...(settings?.defaultParticipants || [])].filter(Boolean))];
  const renameSpeaker = async (event) => {
    event.preventDefault();
    if (!renameFrom || !renameTo.trim()) return;
    try {
      await api.meetings.renameSpeaker(meeting.id, renameFrom, renameTo.trim());
      setNotice(`${renameFrom} is now ${renameTo.trim()} everywhere in this meeting.`);
      showToast(`Renamed ${renameFrom} to ${renameTo.trim()} across the meeting.`);
      setRenameFrom(''); setRenameTo(''); await refresh();
    } catch (error) { setNotice(error.message); }
  };
  const syncNotion = async () => { try { const result = await api.exports.notion(meeting.id); setNotice('Synced to Notion'); showToast('Meeting synced to Notion.'); window.open(result.url, '_blank', 'noopener'); await refresh(); } catch (error) { setNotice(error.message); } };
  const openObsidian = async () => { try { const result = await api.exports.obsidian(meeting.id); window.location.href = result.uri; setNotice('Sent to Obsidian'); showToast('Opening this meeting in Obsidian.'); } catch (error) { setNotice(error.message); } };
  return <main className="page meeting-page">
    <button className="text-button" onClick={back}>← All meetings</button>
    <section className="meeting-heading"><div><span className="eyebrow">Meeting intelligence</span><h1>{meeting.title}</h1><p>{formatDate(meeting.started_at)} · {meeting.transcript?.length || 0} transcript segments</p></div>
      <div className="export-actions"><button className="primary" onClick={syncNotion} title="Create a rich Notion page with decisions, tasks, and transcript">Sync to Notion</button><button className="ghost" onClick={openObsidian} title="Open Obsidian on this Mac and create the meeting note">Open in Obsidian App</button><a className="ghost button-link" href={api.exports.downloadUrl(meeting.id)} onClick={() => setNotice('Downloading a clean Markdown note for your vault.')} title="Download the Markdown file without opening Obsidian">Download `.md` for Vault</a></div>
    </section>
    {notice && <p className="notice">{notice}</p>}
    <section className="speaker-roster"><div><span className="eyebrow">Speaker roster</span><h2>Rename speakers once, update every record</h2><p>Select a transcript label, enter the real participant name, and Manuscript updates decisions and responsibilities too.</p></div>
      <div className="speaker-list">{speakers.map((speaker) => <button type="button" className={renameFrom === speaker ? 'speaker-chip active' : 'speaker-chip'} key={speaker} onClick={() => { setRenameFrom(speaker); setRenameTo(''); }}>{speaker}</button>)}</div>
      {renameFrom && <form className="rename-form" onSubmit={renameSpeaker}><label className="field"><span>Rename {renameFrom} to</span><input autoFocus list="known-participants" value={renameTo} onChange={(event) => setRenameTo(event.target.value)} placeholder="Priya" /></label><datalist id="known-participants">{knownNames.map((name) => <option key={name} value={name} />)}</datalist><button className="primary" type="submit">Save speaker name</button><button className="ghost" type="button" onClick={() => setRenameFrom('')}>Cancel</button></form>}
    </section>
    <section className="summary-card"><span className="eyebrow">Structured summary</span><p>{meeting.structured?.summary || 'Summary is not available.'}</p></section>
    <section><div className="section-title"><div><span className="eyebrow">Decision log</span><h2>Identified decisions</h2></div><span className="count">{meeting.structured?.decisions?.length || 0}</span></div>
      <div className="decision-list">{(meeting.structured?.decisions || []).map((decision, index) => <article className="decision-card" key={`${decision.decision}-${index}`}><CheckCircle2 size={20} /><div><h3>{decision.decision || decision.text}</h3>{decision.context && <p>{decision.context}</p>}{decision.quote && <blockquote>“{decision.quote}” <span>{decision.timestamp}</span></blockquote>}</div></article>)}</div>
    </section>
    <section><div className="section-title"><div><span className="eyebrow">Responsibilities</span><h2>Assigned actions</h2></div><span className="count">{meeting.actions?.length || 0}</span></div>
      <div className="action-table">{(meeting.actions || []).map((action) => <div className="action-row" key={action.id}><CircleDot size={16} /><strong>@{action.owner}</strong><span>{action.task}</span><span className="tag">{action.priority}</span><span>{action.deadline || 'No deadline'}</span></div>)}</div>
    </section>
    <section><div className="section-title"><div><span className="eyebrow">Named transcript</span><h2>What everyone said</h2></div><span className="count">{meeting.transcript?.length || 0}</span></div><div className="transcript-list">{(meeting.transcript || []).map((segment, index) => <article className="transcript-row" key={`${segment.startTime}-${index}`}><div><strong>{segment.speaker || 'Unassigned speaker'}</strong><time>{formatDate(new Date(new Date(meeting.started_at).getTime() + (Number(segment.startTime) || 0) * 1000))}</time></div><p>{segment.text}</p></article>)}</div></section>
  </main>;
}

function ActionTracker({ actions, meetings, refresh, openMeeting, settings }) {
  const [filters, setFilters] = useState({ owner: '', priority: '', meetingId: '' });
  const [showAssign, setShowAssign] = useState(false);
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState({ task: '', owner: '', priority: 'MEDIUM', deadline: '', meetingId: '', sourceQuote: '' });
  const owners = useMemo(() => [...new Set([
    ...actions.map((action) => action.owner), settings?.userName, ...(settings?.defaultParticipants || []),
  ].filter(Boolean))].sort(), [actions, settings]);
  const visible = actions.filter((action) => (!filters.owner || action.owner === filters.owner)
    && (!filters.priority || action.priority === filters.priority)
    && (!filters.meetingId || action.meeting_id === filters.meetingId));
  const update = async (id, patch, message) => {
    try { await api.actions.update(id, patch); setNotice(message); showToast(message); await refresh(); } catch (error) { setNotice(error.message); }
  };
  const assign = async (event) => {
    event.preventDefault();
    try {
      await api.actions.create(draft);
      setDraft({ task: '', owner: '', priority: 'MEDIUM', deadline: '', meetingId: '', sourceQuote: '' });
      setShowAssign(false); setNotice('New action assigned.'); showToast('New action assigned.'); await refresh();
    } catch (error) { setNotice(error.message); }
  };
  const pushNotion = async (action) => {
    try { const result = await api.actions.notion(action.id); setNotice('Source meeting synced to Notion.'); showToast('Source meeting synced to Notion.'); window.open(result.url, '_blank', 'noopener'); } catch (error) { setNotice(error.message); }
  };
  const pushObsidian = async (action) => {
    try { const result = await api.actions.obsidian(action.id); setNotice('Source meeting sent to Obsidian.'); showToast('Opening source meeting in Obsidian.'); window.location.href = result.uri; } catch (error) { setNotice(error.message); }
  };
  const addGoogleCalendar = async (action) => {
    try { const result = await api.actions.calendar(action.id); window.open(result.googleCalendarUrl, '_blank', 'noopener'); setNotice('Opened this deadline in Google Calendar.'); showToast('Opened action deadline in Google Calendar.'); } catch (error) { setNotice(error.message); }
  };
  return <main className="page action-page"><section className="hero compact"><span className="eyebrow">Action & Decision Tracker</span><h1>Accountability across every meeting.</h1><p>Assign work, preserve the exact source quote, and move responsibilities from pending to complete.</p></section>
    <section className="tracker-toolbar" aria-label="Action filters">
      <label className="field"><span>Assignee</span><select value={filters.owner} onChange={(event) => setFilters((current) => ({ ...current, owner: event.target.value }))}><option value="">All people</option>{owners.map((name) => <option key={name}>{name}</option>)}</select></label>
      <label className="field"><span>Priority</span><select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}><option value="">All priorities</option>{PRIORITIES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="field"><span>Source meeting</span><select value={filters.meetingId} onChange={(event) => setFilters((current) => ({ ...current, meetingId: event.target.value }))}><option value="">All meetings</option>{meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.title}</option>)}</select></label>
      <button className="primary" type="button" onClick={() => setShowAssign(true)} title="Create and assign a responsibility"><Plus size={17} /> Assign New Action</button>
    </section>
    {notice && <p className="notice tracker-notice" role="status">{notice}</p>}
    <div className="kanban">{STATUSES.map((status) => <section className={`kanban-column status-${status.toLowerCase()}`} key={status} onDragOver={(event) => event.preventDefault()} onDrop={(event) => update(event.dataTransfer.getData('text/action-id'), { status }, `Moved to ${statusNames[status]}.`)}>
      <div className="column-title"><h2>{statusNames[status]}</h2><span className="count">{visible.filter((action) => action.status === status).length}</span></div>
      {visible.filter((action) => action.status === status).map((action) => <article className="task-card" key={action.id} draggable onDragStart={(event) => event.dataTransfer.setData('text/action-id', action.id)}>
        <div className="task-meta"><span className={`tag priority-${action.priority.toLowerCase()}`}>{action.priority}</span>{action.deadline && <time>{action.deadline}</time>}</div>
        <h3>{action.task}</h3>
        <label className="assignee-control" title="Reassign this action"><span className="owner-initials" aria-hidden="true">{String(action.owner || 'U').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><select aria-label={`Owner for ${action.task}`} value={action.owner} onChange={(event) => update(action.id, { owner: event.target.value }, `Reassigned to ${event.target.value}.`)}>{[...new Set([action.owner, ...owners])].map((name) => <option key={name}>{name}</option>)}</select></label>
        {action.meeting_id ? <button className="meeting-source" type="button" onClick={() => openMeeting(action.meeting_id)}><ExternalLink size={14} /> {action.meeting_title || 'Open source meeting'}</button> : <span className="standalone-source">Standalone action</span>}
        {action.source_quote && <blockquote>“{action.source_quote}”{action.source_timestamp && <cite>{action.source_timestamp}</cite>}</blockquote>}
        <label className="field compact-field"><span>Status</span><select aria-label={`Status for ${action.task}`} value={action.status} onChange={(event) => update(action.id, { status: event.target.value }, `Moved to ${statusNames[event.target.value]}.`)}>{STATUSES.map((value) => <option key={value} value={value}>{statusNames[value]}</option>)}</select></label>
        <div className="task-actions">
          <button type="button" onClick={() => pushNotion(action)} disabled={!action.meeting_id} title="Sync the source meeting and all actions to Notion">Notion</button>
          <button type="button" onClick={() => pushObsidian(action)} disabled={!action.meeting_id} title="Open the source meeting note in Obsidian">Obsidian</button>
          {action.deadline && <><button type="button" onClick={() => addGoogleCalendar(action)} title="Add deadline to Google Calendar"><CalendarPlus size={14} /> Google</button><a href={api.actions.calendarDownloadUrl(action.id)} title="Download deadline as an ICS calendar event"><Download size={14} /> .ics</a></>}
        </div>
      </article>)}
    </section>)}</div>
    {showAssign && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAssign(false); }}><section className="assign-dialog" role="dialog" aria-modal="true" aria-labelledby="assign-title"><div><span className="eyebrow">New responsibility</span><h2 id="assign-title">Assign New Action</h2><p>Create work from any meeting or add a standalone responsibility.</p></div><form onSubmit={assign}>
      <label className="field full-field"><span>Task description</span><input autoFocus required value={draft.task} onChange={(event) => setDraft((current) => ({ ...current, task: event.target.value }))} placeholder="Send the revised launch plan" /></label>
      <label className="field"><span>Assigned person</span><input required list="action-owners" value={draft.owner} onChange={(event) => setDraft((current) => ({ ...current, owner: event.target.value }))} placeholder="Priya" /></label><datalist id="action-owners">{owners.map((name) => <option key={name} value={name} />)}</datalist>
      <label className="field"><span>Priority</span><select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))}>{PRIORITIES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="field"><span>Deadline</span><input type="date" value={draft.deadline} onChange={(event) => setDraft((current) => ({ ...current, deadline: event.target.value }))} /></label>
      <label className="field"><span>Source meeting (optional)</span><select value={draft.meetingId} onChange={(event) => setDraft((current) => ({ ...current, meetingId: event.target.value }))}><option value="">Standalone action</option>{meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.title}</option>)}</select></label>
      <label className="field full-field"><span>Exact source quote (optional)</span><input value={draft.sourceQuote} onChange={(event) => setDraft((current) => ({ ...current, sourceQuote: event.target.value }))} placeholder="Priya, please send the plan by Friday." /></label>
      <div className="dialog-actions full-field"><button className="ghost" type="button" onClick={() => setShowAssign(false)}>Cancel</button><button className="primary" type="submit"><Plus size={16} /> Assign Action</button></div>
    </form></section></div>}
  </main>;
}

function toLocalInput(value) {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function localDateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function CalendarView({ schedules, refresh }) {
  const [mode, setMode] = useState('month');
  const [anchor, setAnchor] = useState(new Date());
  const [notice, setNotice] = useState('');
  const emptyDraft = { title: '', startAt: toLocalInput(new Date(Date.now() + 3600000)), durationMinutes: 30, meetUrl: '', participants: '', agenda: '' };
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState('');
  const range = useMemo(() => {
    const first = mode === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth(), 1) : new Date(anchor);
    first.setHours(0, 0, 0, 0);
    first.setDate(first.getDate() - first.getDay());
    return Array.from({ length: mode === 'month' ? 42 : 7 }, (_, index) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + index));
  }, [anchor, mode]);
  const scheduleFor = (day) => schedules.filter((meeting) => localDateKey(meeting.start_at) === localDateKey(day));
  const chooseDay = (day) => {
    const selected = new Date(day); selected.setHours(9, 0, 0, 0);
    setDraft((current) => ({ ...current, startAt: toLocalInput(selected) }));
  };
  const edit = (meeting) => {
    setEditingId(meeting.id);
    setDraft({ title: meeting.title, startAt: toLocalInput(meeting.start_at), durationMinutes: meeting.duration_minutes, meetUrl: meeting.meet_url || '', participants: (meeting.participants || []).join(', '), agenda: meeting.agenda || '' });
  };
  const save = async (event) => {
    event.preventDefault();
    const values = { ...draft, startAt: new Date(draft.startAt).toISOString(), participants: draft.participants.split(',').map((name) => name.trim()).filter(Boolean) };
    try {
      if (editingId) await api.calendar.update(editingId, values); else await api.calendar.create(values);
      setNotice(editingId ? 'Scheduled meeting updated.' : 'Meeting scheduled.');
      showToast(editingId ? 'Scheduled meeting updated.' : 'Meeting scheduled.');
      setEditingId(''); setDraft(emptyDraft); await refresh();
    } catch (error) { setNotice(error.message); }
  };
  const remove = async (meeting) => {
    try { await api.calendar.remove(meeting.id); setNotice(`Removed ${meeting.title}.`); showToast(`Removed ${meeting.title}.`); if (editingId === meeting.id) { setEditingId(''); setDraft(emptyDraft); } await refresh(); } catch (error) { setNotice(error.message); }
  };
  const addGoogle = async (meeting) => {
    try { const result = await api.calendar.export(meeting.id); window.open(result.googleCalendarUrl, '_blank', 'noopener'); setNotice('Opened meeting in Google Calendar.'); showToast('Opened meeting in Google Calendar.'); } catch (error) { setNotice(error.message); }
  };
  const joinAndRecord = (meeting) => {
    try {
      const url = new URL(meeting.meet_url);
      url.hash = `manuscript=${encodeURIComponent(JSON.stringify({ id: meeting.id, title: meeting.title, participants: meeting.participants || [], agenda: meeting.agenda || '' }))}`;
      window.open(url.toString(), '_blank', 'noopener');
      setNotice('Opened Google Meet with the title, participants, and agenda primed. Use Start tab + microphone recording in the Manuscript pill.');
      showToast('Google Meet opened with Manuscript context ready.');
    } catch { setNotice('Add a valid Google Meet link before joining.'); }
  };
  const navigate = (direction) => setAnchor((current) => {
    const next = new Date(current);
    if (mode === 'month') next.setMonth(next.getMonth() + direction); else next.setDate(next.getDate() + direction * 7);
    return next;
  });
  const upcoming = schedules.filter((meeting) => new Date(meeting.start_at) >= new Date()).slice(0, 8);
  return <main className="page calendar-page"><section className="hero compact"><span className="eyebrow">Calendar & Schedule</span><h1>Plan the meeting before it starts.</h1><p>Schedule Google Meet sessions, prepare participants and an agenda, then export to the calendar you already use.</p></section>
    <section className="calendar-toolbar"><div><button className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}>Month</button><button className={mode === 'week' ? 'active' : ''} onClick={() => setMode('week')}>Week</button></div><div className="calendar-nav"><button onClick={() => navigate(-1)} title={`Previous ${mode}`}><ChevronLeft size={17} /> Previous</button><strong>{anchor.toLocaleDateString(undefined, mode === 'month' ? { month: 'long', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })}</strong><button onClick={() => navigate(1)} title={`Next ${mode}`}>Next <ChevronRight size={17} /></button></div></section>
    <div className="calendar-layout"><section className={`calendar-grid ${mode}`} aria-label={`${mode} calendar`}>
      {range.map((day) => <article className={`calendar-day ${day.getMonth() !== anchor.getMonth() && mode === 'month' ? 'outside' : ''}`} key={day.toISOString()}><button className="day-number" type="button" onClick={() => chooseDay(day)} title="Schedule a meeting on this day"><span>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span>{day.getDate()}</button><div className="day-events">{scheduleFor(day).map((meeting) => <button key={meeting.id} type="button" onClick={() => edit(meeting)}><time>{new Date(meeting.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>{meeting.title}</button>)}</div></article>)}
    </section><aside className="schedule-editor"><span className="eyebrow">{editingId ? 'Edit meeting' : 'New meeting'}</span><h2>{editingId ? 'Update schedule' : 'Schedule Meeting'}</h2><form onSubmit={save}>
      <label className="field"><span>Meeting title</span><input required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Weekly product review" /></label>
      <label className="field"><span>Date & time</span><input required type="datetime-local" value={draft.startAt} onChange={(event) => setDraft((current) => ({ ...current, startAt: event.target.value }))} /></label>
      <label className="field"><span>Duration (minutes)</span><input required min="5" step="5" type="number" value={draft.durationMinutes} onChange={(event) => setDraft((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} /></label>
      <label className="field"><span>Google Meet link</span><input type="url" value={draft.meetUrl} onChange={(event) => setDraft((current) => ({ ...current, meetUrl: event.target.value }))} placeholder="https://meet.google.com/abc-defg-hij" /></label>
      <label className="field"><span>Participant names</span><input value={draft.participants} onChange={(event) => setDraft((current) => ({ ...current, participants: event.target.value }))} placeholder="Priya, Gokul" /><small>Separate names with commas.</small></label>
      <label className="field"><span>Pre-meeting agenda</span><textarea rows="4" value={draft.agenda} onChange={(event) => setDraft((current) => ({ ...current, agenda: event.target.value }))} placeholder="Decisions to make and topics to cover" /></label>
      <div className="editor-actions">{editingId && <button className="ghost" type="button" onClick={() => { setEditingId(''); setDraft(emptyDraft); }}>Cancel edit</button>}<button className="primary" type="submit">{editingId ? 'Save Changes' : 'Schedule Meeting'}</button></div>
    </form>{notice && <p className="notice" role="status">{notice}</p>}</aside></div>
    <section><div className="section-title"><div><span className="eyebrow">Upcoming agenda</span><h2>Your next meetings</h2></div><span className="count">{upcoming.length}</span></div><div className="agenda-list">{upcoming.length ? upcoming.map((meeting) => <article key={meeting.id}><div><time>{formatDate(meeting.start_at)}</time><h3>{meeting.title}</h3><p>{(meeting.participants || []).join(', ') || 'No participants added'}{meeting.agenda ? ` · ${meeting.agenda}` : ''}</p></div><div className="agenda-actions">{meeting.meet_url && <button className="join-action" onClick={() => joinAndRecord(meeting)} title="Open Google Meet and preload this meeting in the extension"><Mic size={15} /> Join & Auto-Record</button>}<button onClick={() => edit(meeting)}>Edit</button><button onClick={() => addGoogle(meeting)}><CalendarPlus size={15} /> Add to Google Calendar</button><a href={api.calendar.downloadUrl(meeting.id)}><Download size={15} /> Export .ics</a><button className="danger-action" onClick={() => remove(meeting)} title="Delete this scheduled meeting"><Trash2 size={15} /> Delete</button></div></article>) : <div className="empty"><CalendarDays size={30} /><h3>No upcoming meetings</h3><p>Choose a day in the calendar and add the first session.</p></div>}</div></section>
  </main>;
}

function HowItWorksView({ settings, setView }) {
  const [checks, setChecks] = useState({ media: 'checking', api: 'checking', whisper: 'checking', lmStudio: 'checking', extension: 'checking' });
  const [notice, setNotice] = useState('');
  const steps = [
    { icon: Cpu, number: '01', title: 'Connect Local AI', text: 'Run LM Studio and the Python Whisper server on your MacBook, then enter their UTM-reachable URLs in Settings and test both connections.' },
    { icon: Puzzle, number: '02', title: 'Install the Chrome Extension', text: 'Load the unpacked extension in Chrome, set the Ubuntu VM backend URL, and confirm the green connection status before joining Google Meet.' },
    { icon: Mic, number: '03', title: 'Record & Name Speakers', text: 'Start tab plus microphone capture in Meet. Captions preserve participant names; the speaker roster lets you correct any generic label once.' },
    { icon: Workflow, number: '04', title: 'Act, Schedule & Export', text: 'Move responsibilities across the tracker, schedule follow-ups, and send complete meeting intelligence to Notion, Obsidian, or your calendar.' },
  ];
  const testApi = useCallback(async () => { setChecks((current) => ({ ...current, api: 'checking' })); try { await api.health(); setChecks((current) => ({ ...current, api: 'ready' })); } catch { setChecks((current) => ({ ...current, api: 'needs' })); } }, []);
  const testLocal = useCallback(async () => {
    setChecks((current) => ({ ...current, whisper: 'checking', lmStudio: 'checking' }));
    try { const result = await api.localAi.test(settings || {}); setChecks((current) => ({ ...current, whisper: result.whisper?.ok ? 'ready' : 'needs', lmStudio: result.lmStudio?.ok ? 'ready' : 'needs' })); } catch { setChecks((current) => ({ ...current, whisper: 'needs', lmStudio: 'needs' })); }
  }, [settings]);
  const grantMedia = async () => {
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach((track) => track.stop()); setChecks((current) => ({ ...current, media: 'ready' })); setNotice('Microphone permission granted. Tab audio is requested by Chrome when recording starts.'); } catch (error) { setChecks((current) => ({ ...current, media: 'needs' })); setNotice(`Microphone permission was not granted: ${error.message}`); }
  };
  useEffect(() => {
    let active = true;
    testApi(); testLocal();
    navigator.permissions?.query({ name: 'microphone' }).then((result) => { if (active) setChecks((current) => ({ ...current, media: result.state === 'granted' ? 'ready' : 'needs' })); }).catch(() => { if (active) setChecks((current) => ({ ...current, media: 'needs' })); });
    const extensionReply = (event) => { if (event.source === window && event.data?.type === 'MANUSCRIPT_EXTENSION_PONG') setChecks((current) => ({ ...current, extension: 'ready' })); };
    window.addEventListener('message', extensionReply); window.postMessage({ type: 'MANUSCRIPT_EXTENSION_PING' }, '*');
    const extensionTimer = setTimeout(() => { if (active) setChecks((current) => ({ ...current, extension: current.extension === 'ready' ? 'ready' : 'needs' })); }, 1200);
    return () => { active = false; clearTimeout(extensionTimer); window.removeEventListener('message', extensionReply); };
  }, [testApi, testLocal]);
  const configured = { notion: Boolean(settings?.notionToken && settings?.notionDatabaseId), obsidian: Boolean(settings?.obsidianVault) };
  const rows = [
    { key: 'media', label: 'Microphone & tab audio', detail: 'Needed only while you explicitly record. Audio is sent to your configured backend.', state: checks.media, action: grantMedia, actionLabel: 'Grant Now' },
    { key: 'api', label: 'Ubuntu backend API', detail: 'The browser must reach the Express server on port 3001.', state: checks.api, action: testApi, actionLabel: 'Retry' },
    { key: 'whisper', label: 'MacBook Python Whisper', detail: settings?.localWhisperUrl || 'Configure the UTM-reachable Whisper URL.', state: checks.whisper, action: testLocal, actionLabel: 'Retest' },
    { key: 'lmStudio', label: 'MacBook LM Studio (LFM)', detail: settings?.lmStudioBaseUrl || 'Configure the LM Studio OpenAI-compatible URL.', state: checks.lmStudio, action: testLocal, actionLabel: 'Retest' },
    { key: 'extension', label: 'Chrome extension', detail: 'The minimal bridge checks that Manuscript is loaded in this Chrome profile.', state: checks.extension, action: () => setNotice('Open chrome://extensions, enable Developer mode, choose Load unpacked, and select the built Extension folder.'), actionLabel: 'Fix' },
    { key: 'notion', label: 'Notion integration', detail: 'Requires an integration token and destination page/database ID.', state: configured.notion ? 'ready' : 'needs', action: () => setView('settings'), actionLabel: 'Fix' },
    { key: 'obsidian', label: 'Obsidian vault', detail: 'Requires the exact local vault name for obsidian:// links.', state: configured.obsidian ? 'ready' : 'needs', action: () => setView('settings'), actionLabel: 'Fix' },
  ];
  return <main className="page how-page"><section className="hero compact"><span className="eyebrow">How It Works & Setup Guide</span><h1>From live conversation to accountable work.</h1><p>Follow these four steps once. Manuscript then keeps audio, captions, decisions, responsibilities, and follow-up schedules connected.</p></section>
    <section className="workflow-steps" aria-label="Manuscript workflow">{steps.map(({ icon: Icon, number, title, text }) => <article key={number}><div className="step-marker"><span>{number}</span><Icon size={26} /></div><h2>{title}</h2><p>{text}</p></article>)}</section>
    <section><div className="section-title"><div><span className="eyebrow">Live setup checks</span><h2>Permissions & connections</h2></div></div><div className="setup-checks">{rows.map((row) => <article key={row.key}><span className={`check-state ${row.state}`} aria-label={row.state === 'ready' ? 'Connected' : row.state === 'checking' ? 'Checking' : 'Needs attention'}>{row.state === 'ready' ? <CheckCircle2 size={20} /> : <CircleDot size={20} />}</span><div><h3>{row.label}</h3><p>{row.detail}</p></div><button className={row.state === 'ready' ? 'ghost' : 'primary'} type="button" onClick={row.action} title={`${row.actionLabel} ${row.label}`}>{row.state === 'ready' ? 'Check Again' : row.actionLabel}</button></article>)}</div>{notice && <p className="notice setup-notice" role="status">{notice}</p>}</section>
    <section><div className="section-title"><div><span className="eyebrow">Button dictionary</span><h2>What each primary action does</h2></div></div><div className="button-dictionary">
      <article><Mic size={20} /><div><h3>Record tab + mic</h3><p>Captures the selected Meet tab audio and your microphone until you choose Stop & process.</p></div></article>
      <article><Upload size={20} /><div><h3>Upload audio</h3><p>Sends an existing WebM, MP3, WAV, M4A, or OGG recording through the same intelligence pipeline.</p></div></article>
      <article><Users size={20} /><div><h3>Rename speaker</h3><p>Changes one transcript identity everywhere: transcript, decisions, attendees, and owned actions.</p></div></article>
      <article><ExternalLink size={20} /><div><h3>Sync to Notion</h3><p>Creates a rich page with metadata, summary, decisions, assigned to-dos, and named transcript.</p></div></article>
      <article><BookOpen size={20} /><div><h3>Open in Obsidian</h3><p>Uses the obsidian:// protocol to create a vault note on the MacBook running Chrome.</p></div></article>
      <article><CalendarPlus size={20} /><div><h3>Convert to calendar event</h3><p>Opens Google Calendar or downloads a portable ICS event for Apple Calendar and Outlook.</p></div></article>
    </div></section>
  </main>;
}

function SettingsView({ settings, providers, onSave }) {
  const [form, setForm] = useState(settings || {});
  const [notice, setNotice] = useState('');
  const [localStatus, setLocalStatus] = useState(null);
  const [testingLocal, setTestingLocal] = useState(false);
  useEffect(() => setForm(settings || {}), [settings]);
  const field = (key) => ({ value: form[key] || '', onChange: (event) => setForm((current) => ({ ...current, [key]: event.target.value })) });
  const save = async (event) => { event.preventDefault(); try { await onSave(form); setNotice('Settings saved'); showToast('Settings saved.'); } catch (error) { setNotice(error.message); } };
  const testLocalAi = async () => {
    setTestingLocal(true); setNotice('Testing MacBook local AI services…');
    try {
      const result = await api.localAi.test(form);
      setLocalStatus(result);
      setNotice(result.ok ? 'Local Whisper and LM Studio are connected.' : 'One or more local AI services are unavailable. Check the URLs and Mac firewall.');
      showToast(result.ok ? 'Both Local AI services are connected.' : 'One or more Local AI services need attention.');
    } catch (error) { setNotice(error.message); setLocalStatus(null); }
    finally { setTestingLocal(false); }
  };
  return <main className="page settings-page"><section className="hero compact"><span className="eyebrow">Settings</span><h1>Connect your intelligence stack.</h1><p>API keys stay in the backend data directory and never enter the extension package.</p></section>
    <form onSubmit={save} className="settings-grid">
      <section className="settings-card profile-card"><div><span className="eyebrow">Speaker identity</span><h2>Your profile & default participants</h2><p>These names help Manuscript replace generic speaker labels and prefill meeting rosters.</p></div>
        <label className="field"><span>Your name</span><input placeholder="Gokul" {...field('userName')} /></label>
        <label className="field"><span>Common teammates</span><input placeholder="Priya, Rahul, Ananya" value={(Array.isArray(form.defaultParticipants) ? form.defaultParticipants : String(form.defaultParticipants || '').split(',')).join(', ')} onChange={(event) => setForm((current) => ({ ...current, defaultParticipants: event.target.value.split(',').map((name) => name.trim()).filter(Boolean) }))} /><small>Separate names with commas. You can still rename speakers per meeting.</small></label>
      </section>
      <section className="settings-card local-ai-card"><div><span className="eyebrow">Recommended for UTM</span><h2>MacBook Local AI</h2><p>Use the Mac host IP reachable from Ubuntu, such as <code>192.168.64.1</code> or <code>10.0.2.2</code>.</p></div>
        <label className="field"><span>Python Whisper server URL</span><input type="url" placeholder="http://192.168.64.1:8000" {...field('localWhisperUrl')} /><small>Manuscript tries OpenAI `/v1/audio/transcriptions`, `/inference`, then `/transcribe`.</small></label>
        <label className="field"><span>Whisper model ID</span><input placeholder="whisper-1" {...field('localWhisperModel')} /></label>
        <label className="field"><span>LM Studio base URL</span><input type="url" placeholder="http://192.168.64.1:1234/v1" {...field('lmStudioBaseUrl')} /><small>LM Studio must listen on the network, not only localhost.</small></label>
        <label className="field"><span>LM Studio LFM model ID</span><input placeholder="lfm2.5-1.2b-instruct" {...field('lmStudioModel')} /></label>
        <div className="connection-row">
          <button className="ghost" type="button" onClick={testLocalAi} disabled={testingLocal}>{testingLocal ? 'Testing connections…' : 'Test Local AI Models'}</button>
          {localStatus && <div className="connection-badges" aria-live="polite">
            <span className={`connection-badge ${localStatus.whisper?.ok ? 'connected' : 'failed'}`}><i /> Whisper {localStatus.whisper?.ok ? 'Connected' : 'Unavailable'}</span>
            <span className={`connection-badge ${localStatus.lmStudio?.ok ? 'connected' : 'failed'}`}><i /> LM Studio {localStatus.lmStudio?.ok ? 'Connected' : 'Unavailable'}</span>
          </div>}
        </div>
      </section>
      <section className="settings-card"><h2>Transcription</h2><label className="field"><span>Provider</span><select {...field('sttService')}>{(providers?.stt || []).map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
        <label className="field"><span>Groq API key</span><input type="password" {...field('groqApiKey')} /></label><label className="field"><span>Sarvam API key</span><input type="password" {...field('sarvamApiKey')} /></label><label className="field"><span>AssemblyAI API key</span><input type="password" {...field('assemblyAiApiKey')} /></label><label className="field"><span>Google STT API key</span><input type="password" {...field('googleApiKey')} /></label><label className="field"><span>Google Cloud project ID (optional)</span><input {...field('googleCloudProjectId')} /></label></section>
      <section className="settings-card"><h2>Summaries & decisions</h2><label className="field"><span>LLM provider</span><select {...field('llmProvider')}>{(providers?.llm || []).map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
        <label className="field"><span>Gemini API key</span><input type="password" {...field('geminiApiKey')} /></label><label className="field"><span>Anthropic API key</span><input type="password" {...field('claudeApiKey')} /></label></section>
      <section className="settings-card"><h2>Exports</h2><label className="field"><span>Notion integration token</span><input type="password" {...field('notionToken')} /></label><label className="field"><span>Notion page or database ID</span><input {...field('notionDatabaseId')} /></label><label className="field"><span>Obsidian vault name</span><input {...field('obsidianVault')} /></label>
        <label className="toggle"><input type="checkbox" checked={Boolean(form.autoSyncExports)} onChange={(event) => setForm((current) => ({ ...current, autoSyncExports: event.target.checked }))} /><span>Auto-sync to Notion & prepare Obsidian after every Google Meet</span></label></section>
      <div className="form-footer"><button className="primary" type="submit">Save settings</button>{notice && <span className="notice">{notice}</span>}</div>
    </form>
  </main>;
}

export default function App() {
  const [view, setView] = useState('dashboard');
  const [meetings, setMeetings] = useState([]);
  const [actions, setActions] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [settings, setSettings] = useState(null);
  const [providers, setProviders] = useState(null);
  const [selected, setSelected] = useState(null);
  const [progress, setProgress] = useState(null);

  const refresh = useCallback(async () => {
    const [meetingList, actionList, scheduleList] = await Promise.all([api.meetings.list(), api.actions.list(), api.calendar.list()]);
    setMeetings(meetingList); setActions(actionList); setSchedules(scheduleList);
  }, []);
  useEffect(() => { refresh(); Promise.all([api.settings.get(), api.providers()]).then(([nextSettings, nextProviders]) => { setSettings(nextSettings); setProviders(nextProviders); }); }, [refresh]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'actions') { setView('actions'); return; }
    const meetingId = params.get('meeting');
    if (!meetingId) return;
    api.meetings.get(meetingId).then((meeting) => { setSelected(meeting); setView('meeting'); }).catch(() => {});
  }, []);
  useEffect(() => api.events((event) => {
    if (event.type === 'processing') setProgress(event.percent >= 100 ? null : event);
    if (event.type === 'processing-error') setProgress(null);
    if (event.type === 'action-updated' || event.type === 'calendar-updated') refresh();
  }), [refresh]);

  const openMeeting = async (id) => { setSelected(await api.meetings.get(id)); setView('meeting'); };
  const refreshSelected = async () => { await refresh(); if (selected) setSelected(await api.meetings.get(selected.id)); };

  return <><Nav view={view} setView={(next) => { setView(next); if (next !== 'meeting') setSelected(null); }} /><ToastRegion />
    {view === 'dashboard' && <Dashboard meetings={meetings} progress={progress} openMeeting={openMeeting} refresh={refresh} />}
    {view === 'meeting' && <MeetingView meeting={selected} back={() => setView('dashboard')} refresh={refreshSelected} settings={settings} />}
    {view === 'actions' && <ActionTracker actions={actions} meetings={meetings} refresh={refresh} openMeeting={openMeeting} settings={settings} />}
    {view === 'calendar' && <CalendarView schedules={schedules} refresh={refresh} />}
    {view === 'settings' && <SettingsView settings={settings} providers={providers} onSave={async (next) => setSettings(await api.settings.save(next))} />}
    {view === 'how' && <HowItWorksView settings={settings} setView={setView} />}
  </>;
}

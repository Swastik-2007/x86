import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CircleDot, FileAudio, ListChecks, Mic, Settings as SettingsIcon, Upload, Users } from 'lucide-react';
import { api } from './lib/apiClient';
import { startBrowserRecording } from './lib/browserRecorder';

const STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
const statusNames = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed' };

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
      <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}><SettingsIcon size={16} /> Settings</button>
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
        ? <button className="primary" onClick={stop}>Stop & process</button>
        : <button className="primary" disabled={busy} onClick={() => start(true)}><Mic size={17} /> Record tab + mic</button>}
      {!recording && <button className="ghost" disabled={busy} onClick={() => start(false)}>Mic only</button>}
      {!recording && <button className="ghost" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={17} /> Upload audio</button>}
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

function MeetingView({ meeting, back, refresh }) {
  const [notice, setNotice] = useState('');
  if (!meeting) return <main className="page"><div className="empty">Loading meeting…</div></main>;
  const syncNotion = async () => { try { const result = await api.exports.notion(meeting.id); setNotice('Synced to Notion'); window.open(result.url, '_blank', 'noopener'); await refresh(); } catch (error) { setNotice(error.message); } };
  const openObsidian = async () => { try { const result = await api.exports.obsidian(meeting.id); window.location.href = result.uri; setNotice('Sent to Obsidian'); } catch (error) { setNotice(error.message); } };
  return <main className="page meeting-page">
    <button className="text-button" onClick={back}>← All meetings</button>
    <section className="meeting-heading"><div><span className="eyebrow">Meeting intelligence</span><h1>{meeting.title}</h1><p>{formatDate(meeting.started_at)} · {meeting.transcript?.length || 0} transcript segments</p></div>
      <div className="export-actions"><button className="primary" onClick={syncNotion}>Sync to Notion</button><button className="ghost" onClick={openObsidian}>Open in Obsidian</button><a className="ghost button-link" href={api.exports.downloadUrl(meeting.id)}>Download .md</a></div>
    </section>
    {notice && <p className="notice">{notice}</p>}
    <section className="summary-card"><span className="eyebrow">Structured summary</span><p>{meeting.structured?.summary || 'Summary is not available.'}</p></section>
    <section><div className="section-title"><div><span className="eyebrow">Decision log</span><h2>Identified decisions</h2></div><span className="count">{meeting.structured?.decisions?.length || 0}</span></div>
      <div className="decision-list">{(meeting.structured?.decisions || []).map((decision, index) => <article className="decision-card" key={`${decision.decision}-${index}`}><CheckCircle2 size={20} /><div><h3>{decision.decision || decision.text}</h3>{decision.context && <p>{decision.context}</p>}{decision.quote && <blockquote>“{decision.quote}” <span>{decision.timestamp}</span></blockquote>}</div></article>)}</div>
    </section>
    <section><div className="section-title"><div><span className="eyebrow">Responsibilities</span><h2>Assigned actions</h2></div><span className="count">{meeting.actions?.length || 0}</span></div>
      <div className="action-table">{(meeting.actions || []).map((action) => <div className="action-row" key={action.id}><CircleDot size={16} /><strong>@{action.owner}</strong><span>{action.task}</span><span className="tag">{action.priority}</span><span>{action.deadline || 'No deadline'}</span></div>)}</div>
    </section>
  </main>;
}

function ActionTracker({ actions, refresh }) {
  const [owner, setOwner] = useState('');
  const owners = useMemo(() => [...new Set(actions.map((action) => action.owner))].sort(), [actions]);
  const visible = owner ? actions.filter((action) => action.owner === owner) : actions;
  const move = async (id, status) => { await api.actions.update(id, { status }); await refresh(); };
  return <main className="page"><section className="hero compact"><span className="eyebrow">P8 · Pending Action Tracker</span><h1>Accountability across every meeting.</h1><p>Filter by owner, update status, or drag responsibilities between columns.</p></section>
    <label className="field owner-filter"><span>Filter by person</span><select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="">Everyone</option>{owners.map((name) => <option key={name}>{name}</option>)}</select></label>
    <div className="kanban">{STATUSES.map((status) => <section className="kanban-column" key={status} onDragOver={(event) => event.preventDefault()} onDrop={(event) => move(event.dataTransfer.getData('text/action-id'), status)}>
      <div className="column-title"><h2>{statusNames[status]}</h2><span className="count">{visible.filter((action) => action.status === status).length}</span></div>
      {visible.filter((action) => action.status === status).map((action) => <article className="task-card" key={action.id} draggable onDragStart={(event) => event.dataTransfer.setData('text/action-id', action.id)}>
        <span className="tag">{action.priority}</span><h3>{action.task}</h3><p><Users size={14} /> @{action.owner}</p><small>{action.meeting_title} · {action.deadline || 'No deadline'}</small>
        <select aria-label={`Status for ${action.task}`} value={action.status} onChange={(event) => move(action.id, event.target.value)}>{STATUSES.map((value) => <option key={value} value={value}>{statusNames[value]}</option>)}</select>
      </article>)}
    </section>)}</div>
  </main>;
}

function SettingsView({ settings, providers, onSave }) {
  const [form, setForm] = useState(settings || {});
  const [notice, setNotice] = useState('');
  useEffect(() => setForm(settings || {}), [settings]);
  const field = (key) => ({ value: form[key] || '', onChange: (event) => setForm((current) => ({ ...current, [key]: event.target.value })) });
  const save = async (event) => { event.preventDefault(); try { await onSave(form); setNotice('Settings saved'); } catch (error) { setNotice(error.message); } };
  return <main className="page settings-page"><section className="hero compact"><span className="eyebrow">Settings</span><h1>Connect your intelligence stack.</h1><p>API keys stay in the backend data directory and never enter the extension package.</p></section>
    <form onSubmit={save} className="settings-grid">
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
  const [settings, setSettings] = useState(null);
  const [providers, setProviders] = useState(null);
  const [selected, setSelected] = useState(null);
  const [progress, setProgress] = useState(null);

  const refresh = useCallback(async () => {
    const [meetingList, actionList] = await Promise.all([api.meetings.list(), api.actions.list()]);
    setMeetings(meetingList); setActions(actionList);
  }, []);
  useEffect(() => { refresh(); Promise.all([api.settings.get(), api.providers()]).then(([nextSettings, nextProviders]) => { setSettings(nextSettings); setProviders(nextProviders); }); }, [refresh]);
  useEffect(() => {
    const meetingId = new URLSearchParams(location.search).get('meeting');
    if (!meetingId) return;
    api.meetings.get(meetingId).then((meeting) => { setSelected(meeting); setView('meeting'); }).catch(() => {});
  }, []);
  useEffect(() => api.events((event) => {
    if (event.type === 'processing') setProgress(event.percent >= 100 ? null : event);
    if (event.type === 'processing-error') setProgress(null);
    if (event.type === 'action-updated') refresh();
  }), [refresh]);

  const openMeeting = async (id) => { setSelected(await api.meetings.get(id)); setView('meeting'); };
  const refreshSelected = async () => { await refresh(); if (selected) setSelected(await api.meetings.get(selected.id)); };

  return <><Nav view={view} setView={(next) => { setView(next); if (next !== 'meeting') setSelected(null); }} />
    {view === 'dashboard' && <Dashboard meetings={meetings} progress={progress} openMeeting={openMeeting} refresh={refresh} />}
    {view === 'meeting' && <MeetingView meeting={selected} back={() => setView('dashboard')} refresh={refreshSelected} />}
    {view === 'actions' && <ActionTracker actions={actions} refresh={refresh} />}
    {view === 'settings' && <SettingsView settings={settings} providers={providers} onSave={async (next) => setSettings(await api.settings.save(next))} />}
  </>;
}

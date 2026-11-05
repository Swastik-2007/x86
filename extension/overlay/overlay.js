const root = document.getElementById('overlay-root');
let state = 'idle';
let meetingId = null;
let startedAt = 0;
let error = '';
let timer = null;

function send(type, extra = {}) { parent.postMessage({ type, ...extra }, '*'); }
function elapsed() { const seconds = Math.floor((Date.now() - startedAt) / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }

function render() {
  if (state === 'idle') root.innerHTML = `<section><div class="title"><span class="dot ready"></span><div><strong>Manuscript</strong><small>Decision & action intelligence</small></div></div><button class="primary" id="start">Start recording</button></section>`;
  if (state === 'recording') root.innerHTML = `<section><div class="title"><span class="dot recording"></span><div><strong>Recording · <span id="timer">${elapsed()}</span></strong><small>Tab audio + microphone</small></div></div><div class="note-row"><input id="note" placeholder="Quick timestamped note…" /><button class="ghost" id="add">Add</button></div><button class="dark" id="stop">Stop & process</button></section>`;
  if (state === 'processing') root.innerHTML = `<section><div class="title"><span class="spinner"></span><div><strong>Processing meeting</strong><small>Transcribing, finding decisions, assigning actions…</small></div></div></section>`;
  if (state === 'complete') root.innerHTML = `<section><div class="title"><span class="dot ready"></span><div><strong>Meeting intelligence ready</strong><small>Summary, decisions, and actions saved.</small></div></div><div class="actions"><button class="primary" id="notion">Notion</button><button class="ghost" id="obsidian">Obsidian</button><button class="ghost" id="web">View decisions</button></div></section>`;
  if (state === 'error') root.innerHTML = `<section><div class="title"><span class="dot error"></span><div><strong>Could not process meeting</strong><small>${error || 'Unknown error'}</small></div></div><button class="ghost" id="retry">Try again</button></section>`;
  document.getElementById('start')?.addEventListener('click', () => send('START_RECORDING'));
  document.getElementById('stop')?.addEventListener('click', () => { state = 'processing'; clearInterval(timer); render(); send('STOP_RECORDING'); });
  document.getElementById('add')?.addEventListener('click', () => { const input = document.getElementById('note'); if (input.value.trim()) { send('LIVE_NOTE', { text: input.value.trim(), timestamp: Math.floor((Date.now() - startedAt) / 1000) }); input.value = ''; } });
  document.getElementById('notion')?.addEventListener('click', () => send('EXPORT_NOTION', { meetingId }));
  document.getElementById('obsidian')?.addEventListener('click', () => send('EXPORT_OBSIDIAN', { meetingId }));
  document.getElementById('web')?.addEventListener('click', () => send('OPEN_WEB', { meetingId }));
  document.getElementById('retry')?.addEventListener('click', () => { state = 'idle'; render(); });
}

window.addEventListener('message', (event) => {
  const message = event.data || {};
  if (message.type === 'RECORDING_STARTED') { state = 'recording'; startedAt = Date.now(); render(); timer = setInterval(() => { const node = document.getElementById('timer'); if (node) node.textContent = elapsed(); }, 1000); }
  if (message.type === 'PROCESSING_STARTED') { state = 'processing'; render(); }
  if (message.type === 'PROCESSING_COMPLETE') { state = 'complete'; meetingId = message.result?.meeting?.id; render(); }
  if (message.type === 'PROCESSING_ERROR') { state = 'error'; error = message.error; render(); }
});
render();

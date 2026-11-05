const DEFAULT_URL = 'http://localhost:3001';
const input = document.getElementById('backend-url');
const status = document.getElementById('status');
const dot = document.getElementById('dot');
const error = document.getElementById('error');
document.getElementById('version').textContent = `v${chrome.runtime.getManifest().version}`;

function check() {
  status.textContent = 'Checking backend…'; dot.className = '';
  chrome.runtime.sendMessage({ type: 'CHECK_BACKEND' }, (response) => {
    if (response?.success) { status.textContent = 'Backend connected'; dot.className = 'connected'; error.textContent = ''; }
    else { status.textContent = 'Backend unavailable'; dot.className = 'error-dot'; error.textContent = response?.error || 'Check the server URL and network.'; }
  });
}

chrome.storage.local.get('backendUrl').then((stored) => { input.value = stored.backendUrl || DEFAULT_URL; check(); });
document.getElementById('save').addEventListener('click', async () => { await chrome.storage.local.set({ backendUrl: input.value.trim().replace(/\/$/, '') || DEFAULT_URL }); check(); });
document.getElementById('open-web').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'OPEN_WEB' }, () => window.close()));

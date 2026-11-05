async function request(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(body?.error || body || `Request failed (${response.status})`);
  return body;
}

export const api = {
  meetings: {
    list: () => request('/api/meetings'),
    get: (id) => request(`/api/meetings/${encodeURIComponent(id)}`),
    upload: (file, metadata = {}) => {
      const form = new FormData();
      form.append('audio', file, file.name || 'meeting.webm');
      for (const [key, value] of Object.entries(metadata)) {
        form.append(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
      return request('/api/meetings/upload-audio', { method: 'POST', body: form });
    },
  },
  actions: {
    list: (filters = {}) => request(`/api/actions?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value))}`),
    update: (id, patch) => request(`/api/actions/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    }),
  },
  settings: {
    get: () => request('/api/settings'),
    save: (settings) => request('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }),
  },
  providers: () => request('/api/providers'),
  exports: {
    notion: (id) => request(`/api/export/notion/${encodeURIComponent(id)}`, { method: 'POST' }),
    obsidian: (id) => request(`/api/export/obsidian/${encodeURIComponent(id)}`),
    downloadUrl: (id) => `/api/export/obsidian/${encodeURIComponent(id)}?download=1`,
  },
  events(onMessage) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.hostname}:3001/ws`);
    socket.addEventListener('message', (event) => {
      try { onMessage(JSON.parse(event.data)); } catch { /* ignore non-JSON events */ }
    });
    return () => socket.close();
  },
};

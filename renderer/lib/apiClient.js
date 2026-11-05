async function request(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(body?.error || body || `Request failed (${response.status})`);
  return body;
}

export const api = {
  health: () => request('/api/health'),
  meetings: {
    list: () => request('/api/meetings'),
    get: (id) => request(`/api/meetings/${encodeURIComponent(id)}`),
    renameSpeaker: (id, from, to) => request(`/api/meetings/${encodeURIComponent(id)}/rename-speaker`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to }),
    }),
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
    create: (values) => request('/api/actions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
    }),
    remove: (id) => request(`/api/actions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    calendar: (id) => request(`/api/actions/${encodeURIComponent(id)}/calendar`),
    calendarDownloadUrl: (id) => `/api/actions/${encodeURIComponent(id)}/calendar?download=1`,
    notion: (id) => request(`/api/actions/${encodeURIComponent(id)}/export/notion`, { method: 'POST' }),
    obsidian: (id) => request(`/api/actions/${encodeURIComponent(id)}/export/obsidian`),
  },
  calendar: {
    list: (filters = {}) => request(`/api/calendar?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value))}`),
    create: (values) => request('/api/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }),
    update: (id, values) => request(`/api/calendar/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }),
    remove: (id) => request(`/api/calendar/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    export: (id) => request(`/api/calendar/${encodeURIComponent(id)}/export`),
    downloadUrl: (id) => `/api/calendar/${encodeURIComponent(id)}/export?download=1`,
  },
  settings: {
    get: () => request('/api/settings'),
    save: (settings) => request('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }),
  },
  providers: () => request('/api/providers'),
  localAi: {
    test: (values) => request('/api/local-ai/test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
    }),
  },
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

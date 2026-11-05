import { describe, expect, it } from 'vitest';
import exportsModule from '../../src/server/exports';

const { obsidianExport, transcriptLine } = exportsModule;

describe('Obsidian export', () => {
  it('formats named transcript lines for export payloads', () => {
    expect(transcriptLine({ speaker: 'Priya', text: 'Approved', startTime: 75 })).toBe('[1:15] Priya: Approved');
  });
  it('includes frontmatter, decision callouts, assigned checkboxes, and a deep link', () => {
    const result = obsidianExport({
      id: 'meeting-1', title: 'Launch Review', started_at: '2026-11-05T10:00:00.000Z',
      structured: {
        summary: 'The team approved the launch.', attendees: [{ name: 'Asha' }], topics: [],
        decisions: [{ decision: 'Ship Friday', quote: 'Friday is approved', timestamp: '12:40' }],
      },
      actions: [{ task: 'Publish release notes', owner: 'Asha', priority: 'HIGH', deadline: '2026-11-06', status: 'PENDING' }],
      transcript: [],
    }, 'Work');
    expect(result.markdown).toContain('participants: ["Asha"]');
    expect(result.markdown).toContain('tags: [manuscript, meeting]');
    expect(result.markdown).toContain('> [!summary] Executive Summary');
    expect(result.markdown).toContain('> [!decision] Ship Friday');
    expect(result.markdown).toContain('- [ ] **@Asha**: Publish release notes 📅 2026-11-06');
    expect(result.uri).toMatch(/^obsidian:\/\/new\?vault=Work&/);
  });
});

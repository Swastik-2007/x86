import { describe, expect, it } from 'vitest';
import pipelineModule from '../../src/server/pipeline';

const { structuredNotes, normalizedActions } = pipelineModule;

describe('P8 meeting intelligence normalization', () => {
  it('preserves summary and evidence-backed decisions', () => {
    const structured = structuredNotes({
      title: 'Review', summary: 'A short overview', topics: [],
      decisions: [{ decision: 'Proceed', quote: 'Let us proceed', timestamp: '01:02' }],
    });
    expect(structured.summary).toBe('A short overview');
    expect(structured.decisions[0]).toMatchObject({ decision: 'Proceed', quote: 'Let us proceed', timestamp: '01:02' });
  });

  it('flattens responsibilities and defaults tracker status', () => {
    const actions = normalizedActions({ action_items: [{ owner: 'Dev', priority: 'high', tasks: ['Implement API', 'Write tests'] }] });
    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({ owner: 'Dev', priority: 'HIGH', status: 'PENDING' });
  });
});

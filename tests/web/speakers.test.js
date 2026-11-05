import { describe, expect, it } from 'vitest';
import databaseModule from '../../src/server/database';

const { replaceSpeakerReferences } = databaseModule;

describe('speaker rename propagation', () => {
  it('replaces an exact speaker identity across nested meeting intelligence', () => {
    const meeting = {
      transcript: [{ speaker: 'Speaker 0', text: 'I will own this' }],
      structured: {
        attendees: [{ label: 'Speaker 0', name: '' }],
        decisions: [{ decision: 'Speaker 0 approved launch', quote: 'Speaker 0: launch it' }],
      },
    };
    expect(replaceSpeakerReferences(meeting, 'Speaker 0', 'Priya')).toEqual({
      transcript: [{ speaker: 'Priya', text: 'I will own this' }],
      structured: {
        attendees: [{ label: 'Priya', name: '' }],
        decisions: [{ decision: 'Priya approved launch', quote: 'Priya: launch it' }],
      },
    });
  });

  it('does not replace a speaker label embedded inside another word', () => {
    expect(replaceSpeakerReferences('Speaker 1 and Speaker 10', 'Speaker 1', 'Gokul')).toBe('Gokul and Speaker 10');
  });
});

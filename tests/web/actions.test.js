import { describe, expect, it } from 'vitest';
import databaseModule from '../../src/server/database';
import calendarModule from '../../src/server/calendar';

const { normalizeActionInput } = databaseModule;
const { actionCalendarEvent, googleCalendarUrl, ics } = calendarModule;

describe('action tracker records', () => {
  it('normalizes a standalone blocked action with source evidence', () => {
    const action = normalizeActionInput({
      id: 'action-1', task: 'Confirm production access', owner: 'Priya', priority: 'URGENT',
      status: 'BLOCKED', sourceQuote: 'We still need the security approval.', sourceTimestamp: '00:18:42',
      createdAt: '2026-11-05T10:00:00.000Z',
    });
    expect(action).toEqual({
      id: 'action-1', meeting_id: null, task: 'Confirm production access', owner: 'Priya', priority: 'URGENT',
      deadline: null, status: 'BLOCKED', source_quote: 'We still need the security approval.',
      source_timestamp: '00:18:42', created_at: '2026-11-05T10:00:00.000Z',
    });
  });

  it('accepts API and database field names while applying safe defaults', () => {
    const action = normalizeActionInput({ id: 'action-2', task: '  Send notes  ', meeting_id: 'meeting-1' });
    expect(action).toMatchObject({
      id: 'action-2', meeting_id: 'meeting-1', task: 'Send notes', owner: 'Unassigned',
      priority: 'MEDIUM', status: 'PENDING', source_quote: null, source_timestamp: null,
    });
  });

  it('creates Google and ICS calendar targets from an action deadline', () => {
    const event = actionCalendarEvent({
      id: 'action-3', task: 'Review launch plan', owner: 'Gokul', priority: 'HIGH',
      deadline: '2026-11-10', meeting_title: 'Launch review',
    });
    expect(googleCalendarUrl(event)).toContain('calendar.google.com/calendar/render?');
    expect(new URL(googleCalendarUrl(event)).searchParams.get('text')).toBe('Action: Review launch plan');
    expect(ics(event)).toContain('SUMMARY:Action: Review launch plan');
  });
});

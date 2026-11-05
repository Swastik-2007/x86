import { describe, expect, it } from 'vitest';
import databaseModule from '../../src/server/database';
import calendarModule from '../../src/server/calendar';

const { normalizeScheduledMeetingInput } = databaseModule;
const { googleCalendarUrl, ics, scheduledMeetingCalendarEvent } = calendarModule;

describe('meeting scheduler', () => {
  it('normalizes a scheduled meeting with participants and agenda', () => {
    expect(normalizeScheduledMeetingInput({
      id: 'schedule-1', title: '  Product review ', startAt: '2026-11-10T09:30:00.000Z', durationMinutes: 45,
      meetUrl: 'https://meet.google.com/abc-defg-hij', participants: ['Priya', 'Gokul'], agenda: 'Review open decisions',
    }, '2026-11-05T10:00:00.000Z')).toEqual({
      id: 'schedule-1', title: 'Product review', start_at: '2026-11-10T09:30:00.000Z', duration_minutes: 45,
      meet_url: 'https://meet.google.com/abc-defg-hij', participants: ['Priya', 'Gokul'], agenda: 'Review open decisions',
      created_at: '2026-11-05T10:00:00.000Z', updated_at: '2026-11-05T10:00:00.000Z',
    });
  });

  it('creates portable calendar output for a scheduled meeting', () => {
    const event = { title: 'Product review', start: '2026-11-10T09:30:00.000Z', end: '2026-11-10T10:15:00.000Z', location: 'https://meet.google.com/abc-defg-hij', description: 'Review decisions' };
    expect(new URL(googleCalendarUrl(event)).searchParams.get('location')).toBe(event.location);
    expect(ics(event)).toContain('DTSTART:20261110T093000Z');
  });

  it('includes Meet location, duration, participants, and agenda in calendar exports', () => {
    const event = scheduledMeetingCalendarEvent({ id: 'schedule-1', title: 'Product review', start_at: '2026-11-10T09:30:00.000Z', duration_minutes: 45, meet_url: 'https://meet.google.com/abc-defg-hij', participants: ['Priya', 'Gokul'], agenda: 'Review decisions' });
    expect(event.end).toBe('2026-11-10T10:15:00.000Z');
    expect(event.description).toContain('Priya, Gokul');
    expect(ics(event)).toContain('LOCATION:https://meet.google.com/abc-defg-hij');
  });
});

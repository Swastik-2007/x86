'use strict';

function compactUtc(value) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function calendarEvent({ title, start, end, description = '', location = '' }) {
  if (!title || !start) throw new Error('Calendar events require a title and start time');
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date(startDate.getTime() + 30 * 60 * 1000);
  return { title, start: startDate.toISOString(), end: endDate.toISOString(), description, location };
}

function googleCalendarUrl(input) {
  const event = calendarEvent(input);
  const query = new URLSearchParams({
    action: 'TEMPLATE', text: event.title, dates: `${compactUtc(event.start)}/${compactUtc(event.end)}`,
    details: event.description, location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${query}`;
}

function escapeIcs(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function ics(input) {
  const event = calendarEvent(input);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Manuscript//Meeting Intelligence//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${input.uid || `${Date.now()}@manuscript.local`}`, `DTSTAMP:${compactUtc(new Date())}`,
    `DTSTART:${compactUtc(event.start)}`, `DTEND:${compactUtc(event.end)}`, `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description)}`, `LOCATION:${escapeIcs(event.location)}`, 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
}

function actionCalendarEvent(action) {
  if (!action?.deadline) throw new Error('This action does not have a deadline');
  const start = /^\d{4}-\d{2}-\d{2}$/.test(action.deadline) ? `${action.deadline}T09:00:00` : action.deadline;
  return {
    uid: `${action.id}@manuscript.local`, title: `Action: ${action.task}`, start,
    description: `Owner: ${action.owner}\nPriority: ${action.priority}\nSource meeting: ${action.meeting_title || 'Standalone action'}`,
  };
}

function scheduledMeetingCalendarEvent(meeting) {
  const start = new Date(meeting.start_at);
  return {
    uid: `${meeting.id}@manuscript.local`, title: meeting.title, start: start.toISOString(),
    end: new Date(start.getTime() + Number(meeting.duration_minutes || 30) * 60 * 1000).toISOString(),
    location: meeting.meet_url || '',
    description: [`Participants: ${(meeting.participants || []).join(', ') || 'Not specified'}`, meeting.agenda ? `Agenda: ${meeting.agenda}` : ''].filter(Boolean).join('\n'),
  };
}

module.exports = { calendarEvent, googleCalendarUrl, ics, actionCalendarEvent, scheduledMeetingCalendarEvent };

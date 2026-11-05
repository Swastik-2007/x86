'use strict';

const { Client } = require('@notionhq/client');

const text = (content) => [{ type: 'text', text: { content: String(content || '').slice(0, 2000) } }];
const paragraph = (content) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: text(content) } });
const heading = (content) => ({ object: 'block', type: 'heading_2', heading_2: { rich_text: text(content) } });

function transcriptLine(segment) {
  const seconds = Number(segment.startTime) || 0;
  const stamp = `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  return `[${stamp}] ${segment.speaker || 'Unassigned speaker'}: ${segment.text || ''}`;
}

function actionLabel(action) {
  const due = action.deadline ? ` (Due: ${action.deadline})` : '';
  return `@${action.owner || 'Unassigned'}: ${action.task}${due} · ${action.priority || 'MEDIUM'}`;
}

async function notionParent(notion, id, title) {
  try {
    const database = await notion.databases.retrieve({ database_id: id });
    const titleProperty = Object.entries(database.properties || {}).find(([, value]) => value.type === 'title')?.[0] || 'Name';
    return { parent: { database_id: id }, properties: { [titleProperty]: { title: text(title) } } };
  } catch {
    return { parent: { page_id: id }, properties: { title: { title: text(title) } } };
  }
}

async function syncToNotion(meeting, config) {
  if (!config.notionToken || !config.notionDatabaseId) throw new Error('Notion token and page/database ID are required');
  const notion = new Client({ auth: config.notionToken });
  const structured = meeting.structured || {};
  const participants = [...new Set([
    ...(structured.attendees || []).map((item) => typeof item === 'string' ? item : (item.name || item.label)),
    ...(meeting.transcript || []).map((item) => item.speaker),
  ].filter(Boolean))];
  const metadata = [
    `Date: ${String(meeting.started_at || '').slice(0, 10) || 'Unknown'}`,
    `Participants: ${participants.join(', ') || 'Not identified'}`,
    meeting.meeting_url ? `Meeting: ${meeting.meeting_url}` : '',
  ].filter(Boolean).join('\n');
  const children = [heading('Meeting Metadata'), paragraph(metadata), heading('Executive Summary'), paragraph(structured.summary || 'No summary available.')];

  children.push(heading('Decisions Log'));
  for (const decision of structured.decisions || []) {
    const details = [decision.decision || decision.text, decision.quote ? `Quote: “${decision.quote}”` : '', decision.timestamp ? `Timestamp: ${decision.timestamp}` : ''].filter(Boolean).join('\n');
    children.push({ object: 'block', type: 'callout', callout: { rich_text: text(details), icon: { type: 'emoji', emoji: '✅' } } });
  }

  children.push(heading('Action Items'));
  for (const action of meeting.actions || []) {
    children.push({ object: 'block', type: 'to_do', to_do: { rich_text: text(actionLabel(action)), checked: action.status === 'COMPLETED' } });
  }

  const transcriptChildren = (meeting.transcript || []).slice(0, 95).map((segment) => paragraph(transcriptLine(segment)));
  children.push({
    object: 'block', type: 'toggle',
    toggle: { rich_text: text(`Full named transcript (${meeting.transcript?.length || 0} segments)`), children: transcriptChildren.length ? transcriptChildren : [paragraph('No transcript available.')] },
  });

  const parent = await notionParent(notion, config.notionDatabaseId, meeting.title);
  const page = await notion.pages.create({ ...parent, children: children.slice(0, 100) });
  return page.url;
}

function yamlValue(value) {
  return JSON.stringify(String(value || '').replace(/\r?\n/g, ' '));
}

function obsidianExport(meeting, vault = '') {
  const structured = meeting.structured || {};
  const attendees = [...new Set([
    ...(structured.attendees || []).map((item) => typeof item === 'string' ? item : (item.name || item.label)),
    ...(meeting.transcript || []).map((item) => item.speaker),
  ].filter(Boolean))];
  const date = String(meeting.started_at || new Date().toISOString()).slice(0, 10);
  const lines = [
    '---',
    `title: ${yamlValue(meeting.title)}`,
    `date: ${date}`,
    `participants: [${attendees.map(yamlValue).join(', ')}]`,
    'tags: [manuscript, meeting]',
    '---', '',
    `# ${meeting.title}`, '',
    '> [!summary] Executive Summary',
    `> ${String(structured.summary || 'No summary available.').replace(/\n/g, '\n> ')}`, '',
    '## Key Discussion Topics', '',
  ];
  for (const section of structured.topics || []) {
    lines.push(`### ${section.heading || section.title || 'Topic'}`, '', section.content || '', '');
  }
  lines.push('## Decisions Log', '');
  for (const decision of structured.decisions || []) {
    lines.push(`> [!decision] ${decision.decision || decision.text || 'Decision'}`);
    if (decision.quote) lines.push(`> “${decision.quote}”`);
    if (decision.timestamp) lines.push(`> Timestamp: ${decision.timestamp}`);
    lines.push('');
  }
  lines.push('## Action Items', '');
  for (const action of meeting.actions || []) {
    lines.push(`- [${action.status === 'COMPLETED' ? 'x' : ' '}] **@${action.owner || 'Unassigned'}**: ${action.task}${action.deadline ? ` 📅 ${action.deadline}` : ''} · ${action.priority || 'MEDIUM'}`);
  }
  lines.push('', '## Transcript', '');
  for (const segment of meeting.transcript || []) {
    const timestamp = Number.isFinite(Number(segment.startTime)) ? `[${Math.floor(Number(segment.startTime) / 60)}:${String(Math.floor(Number(segment.startTime) % 60)).padStart(2, '0')}] ` : '';
    lines.push(`- ${timestamp}**${segment.speaker || 'Speaker'}:** ${segment.text || ''}`);
  }
  const markdown = `${lines.join('\n').trim()}\n`;
  const safeTitle = meeting.title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 100) || 'Manuscript meeting';
  const filename = `${date}-${safeTitle}.md`;
  const uri = `obsidian://new?vault=${encodeURIComponent(vault)}&name=${encodeURIComponent(safeTitle)}&content=${encodeURIComponent(markdown)}`;
  return { markdown, filename, uri };
}

module.exports = { syncToNotion, obsidianExport, transcriptLine };

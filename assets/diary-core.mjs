export const DRAFT_KEY = 'wasdwry-diary-draft';
export function parseDiary(markdown, path) {
  const lines = markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const heading = lines.findIndex(line => /^#\s+/.test(line));
  const title = heading < 0 ? path.split('/').pop().replace(/\.md$/i, '') : lines[heading].replace(/^#\s+/, '').trim();
  if (heading >= 0) lines.splice(heading, 1);
  const filename = path.match(/(\d{4}-\d{2}-\d{2})(?:-(\d{2})-(\d{2}))?/);
  const metadata = markdown.match(/^日期[:：]\s*(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/m);
  const day = filename?.[1] || metadata?.[1] || '';
  const time = filename?.[2] ? filename[2] + ':' + filename[3] : metadata?.[2] || '00:00';
  while (lines.length && (!lines[0].trim() || /^(日期|心情|标签)[:：]/.test(lines[0].trim()))) lines.shift();
  const body = lines.join('\n').trim();
  return { path, title, date: day ? day + ' ' + time : '未标注时间', dateKey: day, body,
    excerpt: body.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*>\x60]/g, '').replace(/\s+/g, ' ').slice(0, 90) || '还没有正文。' };
}
export function entryHash(path) { return '#diary/' + encodeURIComponent(path.replace(/^diary\//, '')); }
export function entryFromHash(hash) {
  if (!hash.startsWith('#diary/')) return null;
  try {
    const relative = decodeURIComponent(hash.slice(7));
    if (!relative || relative.startsWith('/') || relative.includes('\\') || relative.split('/').some(p => p === '..' || p === '.')) return null;
    return relative.endsWith('.md') ? 'diary/' + relative : null;
  } catch { return null; }
}
export function readDraft(storage) {
  try {
    const raw = storage.getItem(DRAFT_KEY);
    if (!raw) return { draft: null };
    const draft = JSON.parse(raw);
    if (!draft || typeof draft.content !== 'string' || typeof draft.date !== 'string') throw new Error('invalid draft');
    return { draft };
  } catch { return { draft: null, error: true }; }
}
export function writeDraft(storage, draft) {
  try { storage.setItem(DRAFT_KEY, JSON.stringify(draft)); return true; } catch { return false; }
}
export function draftMarkdown(date, content) {
  const display = date.replace('T', ' ');
  return '# ' + display.slice(0, 10) + ' 日记\n\n日期：' + display + '\n\n' + content.trim() + '\n';
}
export function paginate(items, page, size = 12) {
  const count = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), count);
  return { items: items.slice((current - 1) * size, current * size), current, count };
}
export function safeContentUrl(value, base) {
  try { const url = new URL(value, base); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}

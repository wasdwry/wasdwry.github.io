import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDiary, entryHash, entryFromHash, readDraft, writeDraft, draftMarkdown, paginate, safeContentUrl } from '../assets/diary-core.mjs';

test('metadata is removed, body headings and filename time are preserved', () => {
  const entry = parseDiary('# 日记标题\r\n\r\n日期：2026-10-15 12:00\r\n标签：旧标签\r\n\r\n第一段\n\n## 今天\n第二段', 'diary/2026-10-15-19-30-new-diary.md');
  assert.equal(entry.title, '日记标题'); assert.equal(entry.date, '2026-10-15 19:30');
  assert.equal(entry.body, '第一段\n\n## 今天\n第二段');
  assert.equal(parseDiary('没有标题', 'diary/2026-01-01-note.md').body, '没有标题');
});
test('share links round trip nested names; malformed paths are rejected', () => {
  for (const path of ['diary/2026-10-15-12-00-new-diary.md', 'diary/旧日记/海边.md']) assert.equal(entryFromHash(entryHash(path)), path);
  for (const hash of ['#study', '#diary/%', '#diary/%2E%2E%2Fprivate.md', '#diary/%2Fetc.md', '#diary/a%5Cb.md']) assert.equal(entryFromHash(hash), null);
});
test('drafts retain old format, report corrupt and unavailable storage, and export content', () => {
  let value = JSON.stringify({ date: '2026-10-15T12:00', content: '旧草稿' });
  const storage = { getItem: () => value, setItem: (_, next) => { value = next; } };
  assert.equal(readDraft(storage).draft.content, '旧草稿');
  assert.equal(writeDraft(storage, { date: '2026-10-16T09:00', content: '新草稿' }), true);
  assert.equal(readDraft(storage).draft.content, '新草稿');
  value = '{broken'; assert.equal(readDraft(storage).error, true); assert.equal(value, '{broken');
  assert.equal(writeDraft({ setItem() { throw Error('quota'); } }, {}), false);
  assert.equal(readDraft(undefined).error, true);
  assert.equal(draftMarkdown('2026-10-15T12:00', '正文'), '# 2026-10-15 日记\n\n日期：2026-10-15 12:00\n\n正文\n');
});
test('pagination handles an empty search and clamps the page after filtering', () => {
  assert.deepEqual(paginate([], 10), { items: [], current: 1, count: 1 });
  assert.deepEqual(paginate([1, 2, 3], 9, 2), { items: [3], current: 2, count: 2 });
});
test('links resolve relative to Markdown and reject executable schemes', () => {
  assert.equal(safeContentUrl('../assets/photo.webp', 'https://example.org/diary/note.md'), 'https://example.org/assets/photo.webp');
  assert.equal(safeContentUrl('javascript:alert(1)', 'https://example.org'), null);
  assert.equal(safeContentUrl('data:text/html,test', 'https://example.org'), null);
});

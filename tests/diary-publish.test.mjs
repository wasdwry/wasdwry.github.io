import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubPublisher, prepareDiary, encodeMarkdown } from '../assets/diary-publish.mjs';

const credential = 'github_pat_unit_test_only';
const date = '2026-10-16T09:30', body = '海边的早晨 🌊\n第二行：你好！';
function fakeGitHub(options = {}) {
  const calls = [], files = new Map();
  let writes = 0;
  const fetch = async (url, init) => {
    assert.ok(url.startsWith('https://api.github.com/'));
    assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error');
    assert.equal(init.headers.Authorization, 'Bearer ' + credential);
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null });
    const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
    if (url.endsWith('/user')) return response(options.user || { id: 73155150, login: 'wasdwry' }, options.authStatus || 200);
    if (url.endsWith('/repos/wasdwry/wasdwry.github.io')) return response({ full_name: 'wasdwry/wasdwry.github.io' });
    const path = url.split('/contents/')[1]?.split('?')[0];
    assert.match(path, /^diary\/2026-10-16-09-30-new-diary-[a-f0-9]{16}\.md$/);
    if (init.method === 'GET') {
      if (options.beforeRead) await options.beforeRead();
      const file = files.get(path);
      return response(file || {}, file ? 200 : 404);
    }
    assert.equal(init.method, 'PUT');
    const data = JSON.parse(init.body);
    assert.equal(data.branch, 'main'); assert.equal(Object.hasOwn(data, 'sha'), false);
    if (options.writeStatus) return response({}, options.writeStatus);
    writes++; files.set(path, { type: 'file', encoding: 'base64', content: data.content, path });
    if (options.loseResponse) throw new TypeError('Response lost');
    return response({ content: { path }, commit: { sha: 'a'.repeat(40) } }, 201);
  };
  return { publisher: createGitHubPublisher(fetch), files, calls, writes: () => writes };
}
test('UTF-8 content and deterministic paths survive retries and validate input', async () => {
  assert.equal(Buffer.from(encodeMarkdown(body), 'base64').toString('utf8'), body);
  assert.deepEqual(await prepareDiary(date, body), await prepareDiary(date, body));
  assert.notEqual((await prepareDiary(date, body)).path, (await prepareDiary(date, body + '修改')).path);
  for (const invalid of ['../2026-10-16', '2026-02-30T09:00', '2026-10-16T24:30', '2026-10-16']) await assert.rejects(prepareDiary(invalid, body));
  await assert.rejects(prepareDiary(date, ' '), /正文/);
  await assert.rejects(prepareDiary(date, '字'.repeat(180000)), /500 KB/);
});
test('only the author can connect; secrets never appear in the status object', async () => {
  const service = fakeGitHub();
  await assert.rejects(service.publisher.publish(date, body), /先连接/);
  await assert.rejects(service.publisher.connect('ghp_classic_test_only'), /Fine-grained/);
  assert.equal(service.calls.length, 0);
  await service.publisher.connect(credential);
  assert.deepEqual(service.publisher.status(), { connected: true, login: 'wasdwry', busy: false });
  assert.equal(JSON.stringify(service.publisher).includes(credential), false);
  service.publisher.disconnect();
  assert.equal(service.publisher.status().connected, false);
  const outsider = fakeGitHub({ user: { id: 999, login: 'someone' } });
  await assert.rejects(outsider.publisher.connect(credential), /只有站点作者/);
  assert.equal(outsider.publisher.status().connected, false);
  const expired = fakeGitHub({ authStatus: 401 });
  await assert.rejects(expired.publisher.connect(credential), /已过期/);
});
test('create-only publication sends the exact Markdown; repeated submissions are idempotent', async () => {
  const service = fakeGitHub(); await service.publisher.connect(credential);
  const saved = await service.publisher.publish(date, body);
  assert.equal(saved.alreadyPublished, false); assert.match(saved.fileUrl, /^https:\/\/github.com\/wasdwry\/wasdwry.github.io\/blob\/main\/diary\//);
  assert.equal(Buffer.from(service.files.get(saved.path).content, 'base64').toString('utf8'), '# 2026-10-16 日记\n\n日期：2026-10-16 09:30\n\n' + body + '\n');
  assert.equal((await service.publisher.publish(date, body)).alreadyPublished, true);
  assert.equal(service.writes(), 1);
});
test('lost response is reconciled against the server without creating another diary', async () => {
  const service = fakeGitHub({ loseResponse: true }); await service.publisher.connect(credential);
  assert.equal((await service.publisher.publish(date, body)).alreadyPublished, true);
  assert.equal(service.writes(), 1);
});
test('existing different content is never overwritten and insufficient permission preserves the draft', async () => {
  const service = fakeGitHub(); await service.publisher.connect(credential);
  const draft = await prepareDiary(date, body);
  service.files.set(draft.path, { type: 'file', encoding: 'base64', content: encodeMarkdown('old') });
  await assert.rejects(service.publisher.publish(date, body), /未覆盖/); assert.equal(service.writes(), 0);
  const denied = fakeGitHub({ writeStatus: 403 }); await denied.publisher.connect(credential);
  await assert.rejects(denied.publisher.publish(date, body), /Read and write/);
  assert.equal(denied.writes(), 0); assert.equal(denied.publisher.status().busy, false);
});
test('concurrent clicks cannot issue concurrent writes', async () => {
  const service = fakeGitHub(); await service.publisher.connect(credential);
  const first = service.publisher.publish(date, body);
  await assert.rejects(service.publisher.publish(date, body), /请勿重复/);
  await first; assert.equal(service.writes(), 1);
});
test('disconnecting during the preliminary read prevents a later write', async () => {
  let release, reached;
  const reading = new Promise(resolve => { reached = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const service = fakeGitHub({ beforeRead: async () => { reached(); await gate; } });
  await service.publisher.connect(credential);
  const pending = service.publisher.publish(date, body); await reading;
  service.publisher.disconnect(); release();
  await assert.rejects(pending, /未提交/); assert.equal(service.writes(), 0);
});
